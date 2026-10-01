javascript:(function() {
    try {
        const clipText = prompt("اضغط Ctrl + V للصق اللينك أو الـ ID واضغط Enter:") || "";
        const cleanText = clipText.trim();

        // دالة بتدور على السؤال كامل بناءً على اسمه (Label)
        function getContainer(label) {
            const items = document.querySelectorAll('div[role="listitem"]');
            for (let item of items) {
                if (item.innerText.toLowerCase().includes(label.toLowerCase())) {
                    return item;
                }
            }
            return null;
        }

        // دالة لملء الخانات النصية جوه سؤال معين
        function setInput(label, val) {
            const container = getContainer(label);
            if (container) {
                const input = container.querySelector('input[type="text"], input[type="url"], textarea');
                if (input) {
                    input.focus();
                    input.value = val;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    input.dispatchEvent(new Event('blur', { bubbles: true }));
                    input.style.backgroundColor = "#d4edda";
                }
            } else {
                console.log("لم يتم العثور على خانة: " + label);
            }
        }

        // دالة لاختيار الـ Radio Buttons أو الـ Dropdowns جوه سؤال معين
        function selectOption(label, optionText) {
            const container = getContainer(label);
            if (container) {
                const elements = container.querySelectorAll('span, div');
                for (let el of elements) {
                    if (el.children.length === 0 && el.textContent.trim().toLowerCase() === optionText.toLowerCase()) {
                        const clickable = el.closest('div[role="radio"], div[role="option"]') || el;
                        if (clickable.getAttribute('aria-checked') !== 'true' && clickable.getAttribute('aria-selected') !== 'true') {
                            clickable.click();
                        }
                        break;
                    }
                }
            }
        }

        // 1. عمل شيك على الإيميل (بيدور على سؤال الإيميل أو أول Checkbox في الفورم)
        const emailContainer = getContainer('Email');
        let emailCheckbox = null;
        if (emailContainer) {
            emailCheckbox = emailContainer.querySelector('div[role="checkbox"]');
        }
        if (!emailCheckbox) {
            emailCheckbox = document.querySelector('div[role="checkbox"]');
        }
        if (emailCheckbox && emailCheckbox.getAttribute('aria-checked') !== 'true') {
            emailCheckbox.click();
        }

        // 2. ملء الخانات الثابتة
        setInput('Name', 'Steven Mario');
        selectOption('Shift', 'Morning');
        selectOption('Queue', 'PrecisionMiningEMV');
        selectOption('Task Type', 'Normal');

        // 3. فحص اللينك المنسوخ وتوجيهه للخانة الصح
        if (cleanText !== "") {
            if (cleanText.includes('labeling.robot.car')) {
                setInput('Gulp link', cleanText);
            } else if (cleanText.includes('webviz.robot.car')) {
                setInput('Webviz link', cleanText);
            } else {
                setInput('Road Event', cleanText);
            }
        }

    } catch (err) {
        alert("حدث خطأ: " + err.message);
    }
})();