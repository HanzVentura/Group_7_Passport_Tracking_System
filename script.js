let currentIndex = 0;
const slides = document.querySelectorAll('.slide');
const dots = document.querySelectorAll('.dot');
let slideInterval;

// Function to update the visible slide
function showSlide(index) {
    // Handle wrap-around
    if (index >= slides.length) currentIndex = 0;
    if (index < 0) currentIndex = slides.length - 1;

    // Remove 'active' class from all slides and dots
    slides.forEach(slide => slide.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));

    // Add 'active' class to the targeted slide and dot
    slides[currentIndex].classList.add('active');
    dots[currentIndex].classList.add('active');
}

// Function to move to the next slide automatically
function nextSlide() {
    currentIndex++;
    showSlide(currentIndex);
}

// Function for the left/right arrows
function changeSlide(direction) {
    currentIndex += direction;
    showSlide(currentIndex);
    resetInterval(); // Restart the timer so it doesn't instantly jump
}

// Function for the bottom dots
function setSlide(index) {
    currentIndex = index;
    showSlide(currentIndex);
    resetInterval();
}

// Start the 2-second automatic sliding
function startInterval() {
    slideInterval = setInterval(nextSlide, 2000); 
}

// Reset the interval when a user manually clicks
function resetInterval() {
    clearInterval(slideInterval);
    startInterval();
}

// Initialize the carousel
startInterval();