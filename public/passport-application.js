const applicationType = document.body.dataset.applicationType || 'new';
const applicationLabels = {
    new: {
        title: 'NEW PASSPORT APPLICATION',
        category: 'New First-Time Application',
        description: 'To proceed with your New Passport application, please specify the exact service you require.',
        identityDescription: 'Please upload at least one (1) valid primary government-issued ID.',
        citizenshipDescription: 'A clear, scanned copy of your birth certificate is mandatory for first-time applicants.',
        citizenshipLabel: 'Proof of Philippine Citizenship',
        citizenshipType: 'Birth Certificate (PSA)',
        citizenshipNumber: 'Certificate Number',
        citizenshipDate: 'Date of Registration',
        citizenshipPlaceholder: 'Certificate / Barcode No.'
    },
    renewal: {
        title: 'PASSPORT RENEWAL',
        category: 'Passport Renewal',
        description: 'Provide the details and documents needed to renew your existing Philippine passport.',
        identityDescription: 'Please upload a clear copy of your valid government-issued ID.',
        citizenshipDescription: 'Upload your current or most recently issued Philippine passport.',
        citizenshipLabel: 'Current Passport',
        citizenshipType: 'Current Philippine Passport',
        citizenshipNumber: 'Passport Number',
        citizenshipDate: 'Date of Issue',
        citizenshipPlaceholder: 'Enter passport number'
    }
};

const labels = applicationLabels[applicationType] || applicationLabels.new;

document.addEventListener('DOMContentLoaded', () => {
    document.title = `${labels.title} - Passport Tracking`;
    document.getElementById('pageHeaderTitle').textContent = labels.title;
    document.getElementById('greetingText').textContent = 'Good Day';
    const categoryDescription = document.getElementById('categoryDescription');
    if (categoryDescription) categoryDescription.textContent = labels.description;
    document.getElementById('identityDescription').textContent = labels.identityDescription;
    document.getElementById('citizenshipDescription').textContent = labels.citizenshipDescription;
    document.getElementById('citizenshipTitle').textContent = labels.citizenshipLabel;
    document.getElementById('citizenshipNumberLabel').textContent = labels.citizenshipNumber;
    document.getElementById('citizenshipDateLabel').textContent = labels.citizenshipDate;
    document.getElementById('citizenshipNumber').placeholder = labels.citizenshipPlaceholder;
    document.getElementById('summaryCategory').textContent = labels.category;
    document.getElementById('summaryCitizenship').textContent = labels.citizenshipType;

    document.querySelectorAll('input[type="file"]').forEach(input => {
        input.addEventListener('change', () => updateFileName(input.id, input.dataset.nameTarget));
    });

    loadUserData();
    goToWizardStep(1);
});

async function loadUserData() {
    try {
        const response = await fetch('/api/user-data');
        const data = await response.json();
        if (data.loggedIn && data.fullName) {
            document.getElementById('greetingText').textContent = `Good Day, ${data.fullName}`;
            document.getElementById('userName').textContent = data.fullName;
            document.getElementById('summaryFullName').textContent = data.fullName;
        }
    } catch (error) {
        console.error('Unable to load user data:', error);
    }
}

function updateFileName(inputId, nameId) {
    const fileInput = document.getElementById(inputId);
    const fileName = document.getElementById(nameId);
    if (fileInput.files.length > 0) {
        fileName.textContent = fileInput.files[0].name;
        fileName.style.color = '#10b981';
    } else {
        fileName.textContent = 'No file selected';
        fileName.style.color = '#6b7280';
    }
}

function goToWizardStep(stepNumber) {
    document.querySelectorAll('.step-pane').forEach(pane => { pane.hidden = true; });
    document.querySelectorAll('.wizard-step').forEach(step => { step.className = 'wizard-step'; });

    document.getElementById(`pane${stepNumber}`).hidden = false;
    const stepCount = applicationType === 'renewal' ? 2 : 3;
    for (let index = 1; index <= stepCount; index += 1) {
        const step = document.getElementById(`wStep${index}`);
        if (index < stepNumber) step.classList.add('completed');
        if (index === stepNumber) step.classList.add('active');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validateAndProceed() {
    const idComplete = document.getElementById('idNumber').value.trim()
        && document.getElementById('idExpiry').value
        && document.getElementById('idFile').files.length;
    const citizenshipComplete = document.getElementById('citizenshipNumber').value.trim()
        && document.getElementById('citizenshipDate').value
        && document.getElementById('citizenshipFile').files.length;

    if (!idComplete) {
        alert('Please complete all fields and attach a document for Proof of Identity.');
        return;
    }
    if (!citizenshipComplete) {
        alert(`Please complete all fields and attach a document for ${labels.citizenshipLabel}.`);
        return;
    }

    const selectedId = document.getElementById('idType');
    document.getElementById('summaryIdType').textContent = selectedId.options[selectedId.selectedIndex].text;
    goToWizardStep(applicationType === 'renewal' ? 2 : 3);
}

async function completePayment() {
    const randomId = `PH-${Math.floor(100000 + Math.random() * 900000)}`;
    const userEmail = localStorage.getItem('userEmail');

    if (!userEmail) {
        alert('Please log in before saving your application.');
        return;
    }

    try {
        const response = await fetch('/api/applications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: userEmail,
                applicationId: randomId,
                applicationType: labels.category,
                status: 'Pending Payment'
            })
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Unable to save your application.');
        }
        localStorage.setItem('activeAppId', result.applicationId || randomId);
        localStorage.setItem('applicationType', result.applicationType || labels.category);
        window.location.href = 'payments.html';
    } catch (error) {
        console.error('Unable to save application:', error);
        alert(error.message);
    }
}
