document.addEventListener('DOMContentLoaded', function() {
    const launchButton = document.getElementById('launch-app');
    const emailOption = document.getElementById('invite-email-option');
    const surveyOption = document.getElementById('invite-survey-option');
    const requestInviteBtn = document.getElementById('request-invite-btn');

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
    function checkBetaSignupSurveyFlag() {
        if (window.posthog) {
            // Wait for feature flags to load
            window.posthog.onFeatureFlags(function() {
                const useSurvey = window.posthog.isFeatureEnabled('beta-signup-survey');
                if (useSurvey) {
                    // Show survey button, hide email
                    if (emailOption) emailOption.style.display = 'none';
                    if (surveyOption) surveyOption.style.display = 'block';
                } else {
                    // Keep email option (default)
                    if (emailOption) emailOption.style.display = 'block';
                    if (surveyOption) surveyOption.style.display = 'none';
                }
            });
        } else {
            // PostHog not loaded, show email option (default)
            if (emailOption) emailOption.style.display = 'block';
            if (surveyOption) surveyOption.style.display = 'none';
        }
    }

    // Request invite button handler
    if (requestInviteBtn) {
        requestInviteBtn.addEventListener('click', async function() {
            if (window.posthog) {
                // Track that button was clicked
                window.posthog.capture('invite_request_clicked');

                try {
                    // Get all active surveys
                    window.posthog.getSurveys((surveys) => {
                        const survey = surveys.find(s => s.name === 'Beta Sign-Up');
                        if (survey) {
                            window.posthog.displaySurvey(survey.id, '#invite-survey-option');
                        } else {
                            console.log('No beta-signup-survey found, showing email fallback');
                            showEmailFallback();
                        }
                    });
                } catch (error) {
                    console.error('Error loading survey:', error);
                    showEmailFallback();
                }
            } else {
                // PostHog not loaded, show email option immediately
                showEmailFallback();
            }
        });
    }

    // Helper function to show email fallback
    function showEmailFallback() {
        if (emailOption && surveyOption) {
            surveyOption.style.display = 'none';
            emailOption.style.display = 'block';
        }
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
