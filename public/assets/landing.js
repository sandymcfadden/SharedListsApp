document.addEventListener('DOMContentLoaded', function() {
    const launchButton = document.getElementById('launch-app');
    
    if (launchButton) {
        launchButton.addEventListener('click', function() {
            // Navigate to the React app
            window.location.href = '/manage/#/lists';
        });
    }
    
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
