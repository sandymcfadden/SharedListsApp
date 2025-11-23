document.addEventListener('DOMContentLoaded', function() {
    const launchButton = document.getElementById('launch-app');
    const requestInviteBtn = document.getElementById('request-invite-btn');
    const inviteButtonContainer = document.getElementById('invite-button-container');
    const inviteFormContainer = document.getElementById('invite-form-container');
    const inviteForm = document.getElementById('invite-form');
    const cancelInviteBtn = document.getElementById('cancel-invite-btn');
    const formMessage = document.getElementById('form-message');
    const submitInviteBtn = document.getElementById('submit-invite-btn');

    // Get Supabase configuration from the environment (replaced during build)
    const SUPABASE_URL = '%VITE_SUPABASE_URL%';
    const SUPABASE_ANON_KEY = '%VITE_SUPABASE_ANON_KEY%';

    // Launch app button
    if (launchButton) {
        launchButton.addEventListener('click', function() {
            // Track event
            if (window.posthog) {
                window.posthog.capture('launch_app_clicked');
            }
            // Navigate to the React app
            window.location.href = '/manage/#/lists';
        });
    }

    // Check feature flag for beta signup survey
    let useSurvey = false;

    function checkBetaSignupSurveyFlag() {
        if (window.posthog) {
            // Wait for feature flags to load
            window.posthog.onFeatureFlags(function() {
                useSurvey = window.posthog.isFeatureEnabled('beta-signup-survey');
                console.log('Feature flag beta-signup-survey:', useSurvey);
            });
        }
    }

    // Request invite button - show survey or form based on feature flag
    if (requestInviteBtn) {
        requestInviteBtn.addEventListener('click', function() {
            // Track that button was clicked
            if (window.posthog) {
                window.posthog.capture('invite_request_clicked');
            }

            if (useSurvey && window.posthog) {
                // Try to show PostHog survey
                try {
                    window.posthog.getSurveys((surveys) => {
                        const survey = surveys.find(s => s.name === 'Beta Sign-Up');
                        if (survey) {
                            window.posthog.displaySurvey(survey.id, '#invite-button-container');
                        } else {
                            console.log('No Beta Sign-Up survey found, showing custom form');
                            showCustomForm();
                        }
                    });
                } catch (error) {
                    console.error('Error loading survey:', error);
                    showCustomForm();
                }
            } else {
                // Show custom form
                showCustomForm();
            }
        });
    }

    // Helper function to show custom form
    function showCustomForm() {
        inviteButtonContainer.style.display = 'none';
        inviteFormContainer.style.display = 'block';
    }

    // Cancel button - hide form
    if (cancelInviteBtn) {
        cancelInviteBtn.addEventListener('click', function() {
            // Hide form, show button
            inviteFormContainer.style.display = 'none';
            inviteButtonContainer.style.display = 'block';

            // Reset form
            inviteForm.reset();
            formMessage.style.display = 'none';
        });
    }

    // Form submission
    if (inviteForm) {
        inviteForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const name = document.getElementById('invite-name').value.trim();
            const email = document.getElementById('invite-email').value.trim();

            // Disable submit button and show loading state
            submitInviteBtn.disabled = true;
            submitInviteBtn.textContent = 'Sending...';
            formMessage.style.display = 'none';

            try {
                // Check if Supabase config is available
                if (!SUPABASE_URL || SUPABASE_URL.startsWith('%') || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.startsWith('%')) {
                    throw new Error('Supabase configuration not available');
                }

                // Call Supabase Edge Function
                const response = await fetch(`${SUPABASE_URL}/functions/v1/resend`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                    },
                    body: JSON.stringify({ name, email })
                });

                const result = await response.json();

                if (response.ok) {
                    // Success
                    if (window.posthog) {
                        window.posthog.capture('invite_request_submitted', {
                            success: true
                        });
                    }

                    formMessage.textContent = 'Request submitted successfully! We\'ll be in touch soon.';
                    formMessage.className = 'form-message success';
                    formMessage.style.display = 'block';

                    // Reset form after short delay
                    setTimeout(() => {
                        inviteForm.reset();
                        inviteFormContainer.style.display = 'none';
                        inviteButtonContainer.style.display = 'block';
                        formMessage.style.display = 'none';
                    }, 3000);
                } else {
                    // Error from API
                    throw new Error(result.error || 'Failed to submit request');
                }
            } catch (error) {
                console.error('Error submitting invite request:', error);

                if (window.posthog) {
                    window.posthog.capture('invite_request_submitted', {
                        success: false,
                        error: error.message
                    });
                }

                formMessage.textContent = 'Failed to submit request. Please try again or email sandymc@gmail.com directly.';
                formMessage.className = 'form-message error';
                formMessage.style.display = 'block';
            } finally {
                // Re-enable submit button
                submitInviteBtn.disabled = false;
                submitInviteBtn.textContent = 'Submit Request';
            }
        });
    }

    // Track video interactions
    const videoIframe = document.querySelector('.video-container iframe');
    if (videoIframe) {
        // Track when video section comes into view
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && window.posthog) {
                    window.posthog.capture('demo_video_viewed');
                    observer.disconnect(); // Only track once
                }
            });
        }, { threshold: 0.5 });
        observer.observe(videoIframe);
    }

    // Initialize feature flag check
    checkBetaSignupSurveyFlag();

    // Add some subtle animations
    const features = document.querySelectorAll('.feature, .invite-notice, .video-demo');
    features.forEach((feature, index) => {
        feature.style.opacity = '0';
        feature.style.transform = 'translateY(20px)';

        setTimeout(() => {
            feature.style.transition = 'all 0.6s ease';
            feature.style.opacity = '1';
            feature.style.transform = 'translateY(0)';
        }, index * 200);
    });
});
