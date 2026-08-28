const trackButton = document.getElementById('trackBtn');

trackButton.addEventListener('click', function() {
    const inputVal = document.getElementById('passportInput').value;

    if (inputVal === "") {
        alert("Please enter a reference number first!");
    } else {
        alert("Tracking Passport #" + inputVal + "\nStatus: Approved!");
    }
});