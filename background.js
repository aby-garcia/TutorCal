chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "saveSessions") {
        message.sessions.forEach(session => {
            addEventToGoogleCalendar(session);
        });
    } else if (message.action === "deleteSession") {
        deleteEventFromGoogleCalendar(message.sessionId);
    }
});


async function addEventToGoogleCalendar(session) {
    const { date, student, course } = session;

    // Check for existing events before adding
    const existingEvents = await fetchExistingEvents();
    
    const isInCalendar = existingEvents.some(event => 
        event.summary === `Tutoring Session with ${student}` && 
        new Date(event.start.dateTime).toISOString() === new Date(convertToISO(date)).toISOString()
    );

    if (isInCalendar) {
        console.log('Event already exists in calendar:', session);
        return; // Exit if event already exists
    }

    const event = {
        summary: `Tutoring Session with ${student}`,
        description: `Course: ${course}`,
        start: {
            dateTime: new Date(convertToISO(date)).toISOString(),
            timeZone: 'America/Chicago'
        },
        end: {
            dateTime: new Date(new Date(convertToISO(date)).getTime() + 60 * 60 * 1000).toISOString(), // Assuming 1-hour sessions
            timeZone: 'America/Chicago'
        }
    };

    const token = await getAccessToken();
    fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
    })
    .then(response => response.json())
    .then(data => console.log('Event created:', data))
    .catch(error => console.error('Error creating event:', error));
}

// Function to fetch existing events from Google Calendar
async function fetchExistingEvents() {
    const token = await getAccessToken();
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        console.error('Error fetching existing events:', response.statusText);
        return [];
    }

    const data = await response.json();
    
    return data.items || []; // Return the list of events or an empty array
}

async function getAccessToken() {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, token => {
            if (chrome.runtime.lastError || !token) {
                reject(chrome.runtime.lastError);
                return;
            }
            resolve(token);
        });
    });
}

function convertToISO(dateStr) {
    // Normalize the date string
    // Replace "a.m." with "AM" and "p.m." with "PM" for consistency
    dateStr = dateStr.replace(/a\.m\./i, "AM").replace(/p\.m\./i, "PM");

    // Convert the month abbreviation to a valid date format, accounting for periods
    const monthAbbreviations = {
        "Jan.": "January",
        "Feb.": "February",
        "Mar.": "March",
        "Apr.": "April",
        "May": "May", // May does not have a period
        "Jun.": "June",
        "Jul.": "July",
        "Aug.": "August",
        "Sep.": "September",
        "Oct.": "October",
        "Nov.": "November",
        "Dec.": "December"
    };

    // Replace the abbreviation with the full month name, handling commas
    Object.keys(monthAbbreviations).forEach(abbr => {
        dateStr = dateStr.replace(new RegExp(`\\b${abbr}\\b`, 'i'), monthAbbreviations[abbr]);
    });

    // Remove commas for consistent Date parsing
    dateStr = dateStr.replace(/,\s+/g, ' '); // Replace comma followed by space with just a space

    // Ensure time is formatted correctly with leading zeros if needed
    dateStr = dateStr.replace(/(\d{1,2})\s*(AM|PM)/i, (match, hour, period) => {
        // Always set minutes to 00
        return `${hour} ${period}`; // No need to modify hour, just keep minutes as 00
    });

    // Append ':00' for minutes if not specified
    dateStr = dateStr.replace(/(\d{1,2})\s*(AM|PM)/i, (match, hour, period) => {
        return `${hour}:00 ${period}`;
    });

    // Create a Date object
    const date = new Date(dateStr);

    // Check if the date is valid
    if (isNaN(date.getTime())) {
        throw new Error("Invalid date format");
    }

    // Convert to ISO format
    return date;
}

chrome.identity.getAuthToken({ interactive: true }, function(token) {
    if (chrome.runtime.lastError || !token) {
        console.error(chrome.runtime.lastError);
        return;
    }
    console.log('OAuth Token: ', token);
});

async function deleteEventFromGoogleCalendar(sessionId) {
    const eventId = await getEventIdFromSessionId(sessionId); // Retrieve the corresponding event ID
    if (!eventId) {
        console.error("Event ID not found for session:", sessionId);
        return;
    }

    const token = await getAccessToken();
    fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(async response => {
        if (response.ok) {
            console.log('Event deleted successfully');
            // Remove the session from local storage
            await removeSessionFromLocalStorage(sessionId);
        } else {
            console.error('Error deleting event:', response.statusText);
        }
    })
    .catch(error => console.error('Error deleting event:', error));
}

async function removeSessionFromLocalStorage(sessionId) {
    chrome.storage.local.get(['sessions'], (result) => {
        const sessions = result.sessions || [];
        // Filter out the session to remove
        const updatedSessions = sessions.filter(session => session.id !== sessionId);
        
        // Save the updated sessions back to storage
        chrome.storage.local.set({ sessions: updatedSessions }, () => {
            console.log('Session removed from local storage.');
        });
    });
}

