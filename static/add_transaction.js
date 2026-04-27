document.addEventListener('DOMContentLoaded', function () {
    const dateInput = document.getElementById('date');
    if (dateInput && !dateInput.value) {
        dateInput.valueAsDate = new Date();
    }

    const inventoryFields = document.getElementById('inventoryFields');
    const inventoryItemSelect = document.getElementById('inventory_item_id');
    const quantityInput = document.getElementById('quantity');
    const unitCostInput = document.getElementById('unit_cost');
    const typeOptions = document.querySelectorAll('.type-option input, .form-radio-label input');

    function getTypeLabel(input) {
        if (!input) return null;
        return input.closest('.type-option') || input.closest('.form-radio-label');
    }

    function setActiveState(selectedInput) {
        document.querySelectorAll('.type-option, .form-radio-label').forEach(option => option.classList.remove('active'));

        const activeLabel = getTypeLabel(selectedInput);
        if (activeLabel) {
            activeLabel.classList.add('active');
        }
    }

    function setInventoryFieldsEnabled(enabled) {
        if (!inventoryFields) return;

        inventoryFields.style.display = enabled ? 'block' : 'none';

        [inventoryItemSelect, quantityInput, unitCostInput].forEach((field) => {
            if (!field) return;
            field.disabled = !enabled;

            if (!enabled) {
                field.value = '';
            }
        });
    }

    function updateTypeState() {
        const selectedType = document.querySelector('input[name="type"]:checked');
        const isSale = selectedType && selectedType.value === 'sale';

        setActiveState(selectedType);
        setInventoryFieldsEnabled(isSale);
    }

    typeOptions.forEach(radio => {
        radio.addEventListener('change', updateTypeState);
    });

    updateTypeState();
});
