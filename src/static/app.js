document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const userMenuButton = document.getElementById("user-menu-button");
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");
  const closeModalButton = document.getElementById("close-modal");
  const signupContainer = document.getElementById("signup-container");
  const adminOnlyNotice = document.getElementById("admin-only-notice");

  let authToken = localStorage.getItem("teacherAuthToken") || "";
  let teacherUsername = localStorage.getItem("teacherUsername") || "";

  function setMessage(text, type = "info") {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function updateAuthUI() {
    const isTeacherLoggedIn = Boolean(authToken);

    if (isTeacherLoggedIn) {
      userMenuButton.textContent = `Logout (${teacherUsername})`;
      signupContainer.classList.remove("hidden");
      adminOnlyNotice.classList.add("hidden");
    } else {
      userMenuButton.textContent = "👤 Teacher Login";
      signupContainer.classList.add("hidden");
      adminOnlyNotice.classList.remove("hidden");
    }
  }

  function setLoginState(token, username) {
    authToken = token;
    teacherUsername = username;

    if (token && username) {
      localStorage.setItem("teacherAuthToken", token);
      localStorage.setItem("teacherUsername", username);
    } else {
      localStorage.removeItem("teacherAuthToken");
      localStorage.removeItem("teacherUsername");
    }

    updateAuthUI();
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const showAdminControls = Boolean(authToken);
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        showAdminControls
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      if (authToken) {
        document.querySelectorAll(".delete-btn").forEach((button) => {
          button.addEventListener("click", handleUnregister);
        });
      }
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        setMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        if (response.status === 401) {
          setLoginState("", "");
          setMessage("Your teacher session expired. Please log in again.", "error");
          return;
        }
        setMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      setMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  async function handleTeacherLogin(event) {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.detail || "Login failed", "error");
        return;
      }

      setLoginState(result.token, result.username);
      loginModal.classList.add("hidden");
      loginForm.reset();
      setMessage(`Logged in as ${result.username}`, "success");
      fetchActivities();
    } catch (error) {
      setMessage("Failed to log in. Please try again.", "error");
      console.error("Login error:", error);
    }
  }

  async function handleTeacherLogout() {
    if (!authToken) {
      loginModal.classList.remove("hidden");
      return;
    }

    try {
      await fetch("/auth/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
    } catch (error) {
      console.error("Logout error:", error);
    }

    setLoginState("", "");
    setMessage("Logged out", "info");
    fetchActivities();
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        setMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        if (response.status === 401) {
          setLoginState("", "");
          setMessage("Teacher login required to register students.", "error");
          return;
        }
        setMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      setMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  userMenuButton.addEventListener("click", handleTeacherLogout);
  closeModalButton.addEventListener("click", () => {
    loginModal.classList.add("hidden");
  });
  loginForm.addEventListener("submit", handleTeacherLogin);

  // Initialize app
  updateAuthUI();
  fetchActivities();
});
