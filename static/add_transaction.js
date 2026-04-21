document.addEventListener('DOMContentLoaded', function() {
    const dateInput = document.getElementById('date');
    if (dateInput && !dateInput.value) {
        dateInput.valueAsDate = new Date();
    }

    const typeOptions = document.querySelectorAll('.type-option input');
    typeOptions.forEach(radio => {
        radio.addEventListener('change', function() {
            document.querySelectorAll('.type-option').forEach(opt => opt.classList.remove('active'));
            this.closest('.type-option').classList.add('active');
        });
    });
});
