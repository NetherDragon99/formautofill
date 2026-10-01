javascript:(async function() {
    try {
        // 1. قراءة آخر نص في الحافظة
        const clipText = (await navigator.clipboard.readText()).trim();
        
        // دالة مساعدة لملء الحقول النصية بناءً على اسم الخانة (عشان الكلاسات بتتغير)
        function fillInput(labelText, value) {
            const items = document.querySelectorAll('div[role="listitem"]');
            for (let item of items) {
                // بيدور على الكلمة جوه الـ div عشان يجيب الخانة بتاعتها
                if (item.innerText.toLowerCase().includes(labelText.toLowerCase())) {
                    const input = item.querySelector('input[type="text"], input[type="url"], textarea');
                    if (input) {
                        input.value = value;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.style.backgroundColor = "#e6ffe6"; // لون أخضر فاتح للتأكيد
                    }
                    break;
                }
            }
        }

        // دالة مساعدة لاختيار الـ Radio buttons أو Dropdowns
        function selectOption(valueText) {
            const option = document.querySelector(`div[data-value="${valueText}"]`);
            if (option && option.getAttribute('aria-checked') !== 'true' && option.getAttribute('aria-selected') !== 'true') {
                option.click();
            }
        }

        // 2. عمل Check على خانة الإيميل (غالباً بتكون أول Checkbox في الفورم)
        const emailCheckbox = document.querySelector('div[role="checkbox"]');
        if (emailCheckbox && emailCheckbox.getAttribute('aria-checked') !== 'true') {
            emailCheckbox.click();
        }

        // 3. ملء الخانات الثابتة
        // تأكد إن كلمة 'Name' هي نفس الكلمة المكتوبة فوق الخانة في الفورم
        fillInput('Name', 'Steven Mario'); 
        
        // اختيار القيم الثابتة
        selectOption('Morning');
        selectOption('PrecisionMiningEMV');
        selectOption('Normal');

        // 4. تحديد نوع النص المنسوخ ووضعه في الخانة المناسبة
        if (clipText.includes('labeling.robot.car')) {
            fillInput('Gulp', clipText); // بيبحث عن خانة فيها كلمة Gulp
        } else if (clipText.includes('webviz.robot.car')) {
            fillInput('webviz', clipText); // بيبحث عن خانة فيها كلمة webviz
        } else if (clipText !== "") {
            // لو مش لينك من دول، هيعتبره الـ ID
            fillInput('road event', clipText); // بيبحث عن خانة فيها كلمة road event
        }

        console.log("تم تنفيذ السكريبت وملء البيانات المتاحة!");
        
    } catch (err) {
        alert("تأكد إنك عامل Allow للمتصفح يقرأ الـ Clipboard. التفاصيل: " + err);
    }
})();
