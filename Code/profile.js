document.addEventListener('DOMContentLoaded', () => {
    const profileForm = document.getElementById('profile-form');
    const profileMessage = document.getElementById('profile-message');
    const profilePicPreview = document.getElementById('profile-pic-preview');
    const profilePicUrlInput = document.getElementById('profilePicUrl');

    let fetchedUserProfile = null; // Store fetched data

    // Function to display messages
    function showProfileMessage(message, isError = false) {
        profileMessage.textContent = message;
        profileMessage.className = isError ? 'error' : 'success';
        profileMessage.style.display = 'block';
    }

    // Function to populate form
    function populateForm(userData) {
        document.getElementById('profile-name').value = userData.name || '';
        document.getElementById('profile-email').value = userData.email || '';
        document.getElementById('profile-phone').value = userData.phone || '';
        document.getElementById('profile-address').value = userData.address || '';
        profilePicUrlInput.value = userData.profilePicUrl || '';
        
        // Show profile picture preview if URL exists
        if (userData.profilePicUrl) {
            profilePicPreview.src = userData.profilePicUrl;
            profilePicPreview.style.display = 'block';
        } else {
            profilePicPreview.style.display = 'none';
        }
    }
    
    // Update image preview when URL input changes
    profilePicUrlInput?.addEventListener('input', () => {
        const url = profilePicUrlInput.value.trim();
        if (url) {
            profilePicPreview.src = url;
             profilePicPreview.style.display = 'block';
        } else {
            profilePicPreview.style.display = 'none';
        }
    });

    // Fetch profile data on load
    async function fetchProfile() {
        console.log("Fetching profile data...");
        try {
            // Note: GET /api/profile requires user to be logged in (handled by backend protect middleware)
            const response = await fetch('/api/profile'); 
            const data = await response.json();

            if (!response.ok) {
                // If unauthorized, redirect to login (or show message)
                if (response.status === 401) {
                    alert('Please log in to view your profile.');
                    window.location.href = '/'; // Redirect to homepage
                    return; 
                }
                throw new Error(data.message || 'Failed to fetch profile');
            }
            
            console.log("Profile data received:", data);
            fetchedUserProfile = data; // Store fetched data
            populateForm(data);

        } catch (error) {
            console.error("Error fetching profile:", error);
            showProfileMessage(`Error loading profile: ${error.message}`, true);
        }
    }

    // Handle profile update form submission
    profileForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        profileMessage.style.display = 'none'; // Hide previous messages

        const updatedData = {
            name: document.getElementById('profile-name').value.trim(),
            phone: document.getElementById('profile-phone').value.trim(),
            address: document.getElementById('profile-address').value.trim(),
            profilePicUrl: profilePicUrlInput.value.trim()
        };

        console.log("Submitting profile update:", updatedData);

        try {
            const response = await fetch('/api/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to update profile');
            }
            
            console.log("Profile updated successfully:", result);
            fetchedUserProfile = result; // Update stored profile data
            populateForm(result); // Re-populate form with potentially cleaned data
            showProfileMessage('Profile updated successfully!', false);
            
            // Also update the name in the header if it changed
             if (window.updateHeaderName) { // Check if function exists from script.js
                 window.updateHeaderName(result.name);
             }

        } catch (error) {
            console.error("Error updating profile:", error);
            showProfileMessage(`Error updating profile: ${error.message}`, true);
        }
    });

    // Initial fetch when the page loads
    fetchProfile();
});

// Add a function to global scope so profile.js can call it (simple way)
window.updateHeaderName = function(newName) {
    const userNameEl = document.getElementById('user-name');
    if (userNameEl) {
        userNameEl.textContent = newName;
    }
}; 