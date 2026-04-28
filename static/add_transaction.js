document.addEventListener('DOMContentLoaded', function () {
    const dateInput = document.getElementById('date');
    if (dateInput && !dateInput.value) {
        dateInput.valueAsDate = new Date();
    }

    const inventoryFields = document.getElementById('inventoryFields');
    const inventoryItemSelect = document.getElementById('inventory_item_id');
    const quantityInput = document.getElementById('quantity');
    const unitCostInput = document.getElementById('unit_cost');
    const categorySelect = document.getElementById('category_id');
    const typeOptions = document.querySelectorAll('.type-option input, .form-radio-label input');

    const categoryDefinitions = categorySelect
        ? Array.from(categorySelect.options).map((option) => ({
            value: option.value,
            text: option.textContent.trim(),
            type: option.dataset.categoryType || classifyCategoryType(option.textContent.trim()),
            element: option
        }))
        : [];

    function classifyCategoryType(label) {
        const normalized = label.toLowerCase();

        if (
            normalized.includes('sale') ||
            normalized.includes('sales') ||
            normalized.includes('service') ||
            normalized.includes('services') ||
            normalized.includes('income') ||
            normalized.includes('revenue') ||
            normalized.includes('digital')
        ) {
            return 'sale';
        }

        if (
            normalized.includes('expense') ||
            normalized.includes('rent') ||
            normalized.includes('utility') ||
            normalized.includes('transport') ||
            normalized.includes('marketing') ||
            normalized.includes('supply') ||
            normalized.includes('salary') ||
            normalized.includes('stock') ||
            normalized.includes('inventory') ||
            normalized.includes('cost')
        ) {
            return 'expense';
        }

        return 'all';
    }

    function getTypeLabel(input) {
        if (!input) return null;
        return input.closest('.type-option') || input.closest('.form-radio-label');
    }

    function setActiveState(selectedInput) {
        document.querySelectorAll('.type-option, .form-radio-label').forEach((option) => option.classList.remove('active'));

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

    function rebuildCategoryOptions(selectedType) {
        if (!categorySelect || categoryDefinitions.length === 0) return;

        const currentValue = categorySelect.value;
        const defaultOption = categoryDefinitions.find((definition) => definition.value === '')?.element?.cloneNode(true);
        const matchingOptions = categoryDefinitions
            .filter((definition) => definition.value === '' || definition.type === 'all' || definition.type === selectedType)
            .map((definition) => definition.element.cloneNode(true));

        categorySelect.innerHTML = '';
        if (defaultOption) {
            categorySelect.appendChild(defaultOption);
        }

        matchingOptions
            .filter((option) => option.value !== '')
            .forEach((option) => categorySelect.appendChild(option));

        const hasCurrentValue = Array.from(categorySelect.options).some((option) => option.value === currentValue);
        categorySelect.value = hasCurrentValue ? currentValue : '';
    }

    function updateTypeState() {
        const selectedType = document.querySelector('input[name="type"]:checked');
        const isSale = selectedType && selectedType.value === 'sale';
        const transactionType = isSale ? 'sale' : 'expense';

        setActiveState(selectedType);
        setInventoryFieldsEnabled(isSale);
        rebuildCategoryOptions(transactionType);
    }

    typeOptions.forEach((radio) => {
        radio.addEventListener('change', updateTypeState);
    });

    updateTypeState();
});
