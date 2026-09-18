const API_URL = "http://127.0.0.1:5001";

const state = {
    events: [],
    searchTerm: "",
    sortBy: "upcoming",
    filter: "all"
};

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDate(dateString) {
    if (!dateString) return "Date TBD";

    const date = new Date(`${dateString}T00:00:00`);

    return isNaN(date.getTime())
        ? dateString
        : date.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric"
        });
}

function getSortedEvents(events) {
    const sorted = [...events];

    if (state.sortBy === "popular") {
        sorted.sort((a, b) => Number(b.registrations || 0) - Number(a.registrations || 0));
        return sorted;
    }

    if (state.sortBy === "latest") {
        sorted.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        return sorted;
    }

    sorted.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    return sorted;
}

function updateStats(events) {
    const total = document.getElementById("totalEvents");
    const registrations = document.getElementById("totalRegistrations");
    const upcoming = document.getElementById("upcomingEvents");

    if (!total || !registrations || !upcoming) return;

    const totalRegistrations = events.reduce((sum, event) => sum + Number(event.registrations || 0), 0);
    const now = new Date();
    const upcomingCount = events.filter((event) => {
        if (!event.date) return false;
        return new Date(`${event.date}T00:00:00`) >= now;
    }).length;

    total.textContent = String(events.length);
    registrations.textContent = String(totalRegistrations);
    upcoming.textContent = String(upcomingCount);
}

function updateSummary(events) {
    const summary = document.getElementById("eventSummary");
    if (!summary) return;

    summary.textContent = `${events.length} event${events.length === 1 ? "" : "s"}`;
}

function getFilteredEvents() {
    const search = state.searchTerm.trim().toLowerCase();

    let filtered = state.events.filter((event) => {
        const text = `${event.title || ""} ${event.club || ""} ${event.venue || ""} ${event.description || ""}`.toLowerCase();
        const matchesSearch = !search || text.includes(search);

        if (state.filter === "upcoming") {
            const eventDate = new Date(`${event.date}T00:00:00`);
            const matchesFilter = !Number.isNaN(eventDate) && eventDate >= new Date();
            return matchesSearch && matchesFilter;
        }

        if (state.filter === "popular") {
            return matchesSearch && Number(event.registrations || 0) > 0;
        }

        return matchesSearch;
    });

    return getSortedEvents(filtered);
}

function renderEvents() {
    const container = document.getElementById("events");
    if (!container) return;

    const filteredEvents = getFilteredEvents();
    container.innerHTML = "";
    updateSummary(filteredEvents);

    if (filteredEvents.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No matching events</h3>
                <p>Adjust your filters or add a new campus event.</p>
            </div>
        `;
        return;
    }

    filteredEvents.forEach((event) => {
        const card = document.createElement("article");
        card.className = "event-card";

        const description = escapeHtml(event.description || "No description provided.");
        const dateLabel = formatDate(event.date);

        card.innerHTML = `
            <div class="event-topline">
                <span class="event-date">${dateLabel}</span>
                <span class="event-badge">${escapeHtml(event.club)}</span>
            </div>
            <h3>${escapeHtml(event.title)}</h3>
            <p class="event-meta"><strong>Venue:</strong> ${escapeHtml(event.venue)}</p>
            <p class="event-description">${description}</p>
            <div class="event-footer">
                <span class="registration-count">${Number(event.registrations || 0)} registered</span>
                <button class="secondary-btn" onclick="registerEvent(${event.id})">Register</button>
            </div>
        `;

        container.appendChild(card);
    });
}

async function loadEvents() {
    const container = document.getElementById("events");

    try {
        const response = await fetch(`${API_URL}/api/events`);
        const events = await response.json();

        state.events = events;
        updateStats(events);
        renderEvents();
    } catch (error) {
        console.error(error);
        container.innerHTML = `
            <div class="empty-state error-state">
                <h3>Connection issue</h3>
                <p>Could not connect to the server. Please try again in a moment.</p>
            </div>
        `;
    }
}

async function submitEvent(event) {
    event.preventDefault();

    const formData = {
        title: document.getElementById("title").value.trim(),
        club: document.getElementById("club").value.trim(),
        date: document.getElementById("date").value,
        venue: document.getElementById("venue").value.trim(),
        description: document.getElementById("description").value.trim()
    };

    const message = document.getElementById("message");

    if (!formData.title || !formData.club || !formData.date || !formData.venue) {
        message.textContent = "Please fill in all required fields.";
        message.style.color = "#b91c1c";
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/events`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(formData)
        });

        if (response.ok) {
            message.textContent = "Event created successfully.";
            message.style.color = "#166534";
            document.getElementById("eventForm").reset();
            loadEvents();
        } else {
            const error = await response.json().catch(() => ({}));
            message.textContent = error.error || "Could not create event.";
            message.style.color = "#b91c1c";
        }
    } catch (error) {
        console.error(error);
        message.textContent = "Could not connect to the Flask server.";
        message.style.color = "#b91c1c";
    }
}

async function registerEvent(id) {
    try {
        const response = await fetch(`${API_URL}/api/events/${id}/register`, {
            method: "POST"
        });

        if (response.ok) {
            alert("Registration successful!");
            loadEvents();
        } else {
            const error = await response.json().catch(() => ({}));
            alert(error.error || "Registration failed.");
        }
    } catch (error) {
        console.error(error);
        alert("Could not connect to the server.");
    }
}

function bindControls() {
    const searchInput = document.getElementById("searchInput");
    const sortSelect = document.getElementById("sortSelect");
    const clearFiltersBtn = document.getElementById("clearFiltersBtn");
    const chips = document.querySelectorAll(".filter-chip");

    searchInput.addEventListener("input", (event) => {
        state.searchTerm = event.target.value;
        renderEvents();
    });

    sortSelect.addEventListener("change", (event) => {
        state.sortBy = event.target.value;
        renderEvents();
    });

    clearFiltersBtn.addEventListener("click", () => {
        state.searchTerm = "";
        state.sortBy = "upcoming";
        state.filter = "all";
        searchInput.value = "";
        sortSelect.value = "upcoming";
        chips.forEach((chip) => chip.classList.toggle("active", chip.dataset.filter === "all"));
        renderEvents();
    });

    chips.forEach((chip) => {
        chip.addEventListener("click", () => {
            state.filter = chip.dataset.filter;
            chips.forEach((item) => item.classList.toggle("active", item === chip));
            renderEvents();
        });
    });
}

bindControls();
loadEvents();
