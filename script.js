// Retrieve existing sessions from local storage or initialize an empty array
let sessions = JSON.parse(localStorage.getItem('sessions')) || [];

// Select all rows within the table body
document.querySelectorAll("tbody tr").forEach(row => {
    // Get the <td> elements in the row
    const tds = row.querySelectorAll("td");

    if (tds.length >= 5) {  // Ensure there are at least 5 <td> elements
        const date = tds[1].innerText.trim();  // Date column (2nd <td>)
        const student = tds[2].innerText.trim();  // Student column (3rd <td>)
        const course = tds[3].innerText.trim();  // Course column (4th <td>)

        // Check for duplicates before adding
        const isDuplicate = sessions.some(session => 
            session.date === date && 
            session.student === student && 
            session.course === course
        );

        // Store the session details if the values are valid and not duplicates
        if (date && student && course && !isDuplicate) {
            sessions.push({ date, student, course });
        }
    }
});

// Add event listeners to "delete session" buttons
document.querySelectorAll('[value="Cancel Session"]').forEach(button => {
    button.addEventListener('click', function() {
        const sessionId = this.dataset.sessionId;  // Assuming button has a data attribute for session ID
        
        // Remove session from local storage and update UI
        sessions = sessions.filter(session => session.id !== sessionId);

        // Send a message to background script to delete corresponding Google Calendar event
        chrome.runtime.sendMessage({ action: "deleteSession", sessionId });
        
        // Optionally, update the UI here to reflect the deletion
    });
});

// Update local storage with the new sessions array
localStorage.setItem('sessions', JSON.stringify(sessions));

// Send the scraped session data to the background script
chrome.runtime.sendMessage({ action: "saveSessions", sessions });
