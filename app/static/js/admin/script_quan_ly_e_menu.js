// app/static/js/admin/script_quan_ly_e_menu.js
document.addEventListener('DOMContentLoaded', function() {
    console.log("E-Menu Management Script Loaded - API Integrated!");

    // DOM Elements
    const addMenuItemBtn = document.getElementById('addMenuItemBtn');
    const menuItemFormModal = document.getElementById('menuItemFormModal');
    const closeMenuItemModalBtn = document.getElementById('closeMenuItemModalBtn');
    const menuItemForm = document.getElementById('menuItemForm'); // ID của form trong modal
    const menuItemModalTitle = document.getElementById('menuItemModalTitle');
    const eMenuTableBody = document.getElementById('eMenuTableBody');
    const cancelMenuItemFormBtn = document.getElementById('cancelMenuItemFormBtn');
    const menuItemSearchInput = document.getElementById('menuItemSearchInput');
    const menuCategoryFilter = document.getElementById('menuCategoryFilter');
    const applyMenuItemFilterBtn = document.getElementById('applyMenuItemFilterBtn');
    const hiddenMenuItemId = document.getElementById('menuItemId'); // input hidden
    const imagePreview = document.getElementById('imagePreview');
    const menuItemImageFileInput = document.getElementById('menuItemImageFile'); // Input file mới
    const menuItemImageURLInput = document.getElementById('menuItemImageURL'); // Input type="file"

    let editingMenuItemId = null;
    let allMenuItems = []; // Để lưu trữ dữ liệu từ API
    let currentSortColumn = 'id'; // Mặc định sắp xếp theo ID
    let currentSortDirection = 'asc'; // Mặc định tăng dần


    const categoryNames = {
        "combo": "Combo",
        "do_an_nong": "Đồ ăn nóng",
        "do_uong": "Đồ uống",
        "mon_an_vat": "Món ăn vặt"
    };

    // --- CÁC HÀM SẮP XẾP VÀ RENDER MỚI ---
    function updateSortIcons() {
        document.querySelectorAll('#eMenuTable th[data-sort-by]').forEach(th => {
            const icon = th.querySelector('i.fas');
            if (!icon) return;
            icon.classList.remove('fa-sort-up', 'fa-sort-down');
            
            if (th.dataset.sortBy === currentSortColumn) {
                icon.classList.add(currentSortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down');
            } else {
                icon.classList.add('fa-sort');
            }
        });
    }
    
    function sortData(dataArray, column, direction) {
        if (!column) return dataArray;

        return [...dataArray].sort((a, b) => {
            let valA = a[column];
            let valB = b[column];

            // 1. NULL / UNDEFINED lên cuối
            if (valA == null) return 1;
            if (valB == null) return -1;

            // 2. Nếu là chuỗi, loại bỏ tất cả ký tự không phải chữ số, dấu chấm, dấu trừ
            if (typeof valA === 'string') {
            valA = valA
                .replace(/\./g, '')       // bỏ dấu chấm (điểm) nếu đang dùng "130.000"
                .replace(/,/g, '')        // bỏ dấu phẩy
                .replace(/[^\d.-]/g, '')  // bỏ ký tự khác (ví dụ " VND", "$")
                .trim();
            }
            if (typeof valB === 'string') {
            valB = valB
                .replace(/\./g, '')
                .replace(/,/g, '')
                .replace(/[^\d.-]/g, '')
                .trim();
            }

            // 3. parseFloat, nếu NaN thì dùng 0
            valA = parseFloat(valA) || 0;
            valB = parseFloat(valB) || 0;

            // 4. so sánh
            if (direction === 'asc') {
            return valA - valB;
            } else {
            return valB - valA;
            }
        });
        }


    function applyFiltersAndSort() {
        let filteredItems = [...allMenuItems];

        // Áp dụng bộ lọc
        const searchTerm = menuItemSearchInput ? menuItemSearchInput.value.toLowerCase().trim() : '';
        const categoryTerm = menuCategoryFilter ? menuCategoryFilter.value : '';

        if (searchTerm) {
            filteredItems = filteredItems.filter(item => item.name.toLowerCase().includes(searchTerm));
        }
        if (categoryTerm) {
            filteredItems = filteredItems.filter(item => item.category === categoryTerm);
        }
        
        // Áp dụng sắp xếp
        const sortedAndFiltered = sortData(filteredItems, currentSortColumn, currentSortDirection);
        renderEMenuTable(sortedAndFiltered);
    }

    function addSortEventListeners() {
        document.querySelectorAll('#eMenuTable th[data-sort-by]').forEach(headerCell => {
            headerCell.style.cursor = 'pointer';
            headerCell.addEventListener('click', () => {
                const sortKey = headerCell.dataset.sortBy;
                if (currentSortColumn === sortKey) {
                    currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSortColumn = sortKey;
                    currentSortDirection = 'asc'; // Sắp xếp giá và ID thường mặc định tăng dần
                }
                updateSortIcons();
                applyFiltersAndSort();
            });
        });
    }

    // --- Helper Functions for Validation ---
    function displayValidationError(inputId, message) {
        let errorElement = document.getElementById(inputId + '-error');
        const inputElement = document.getElementById(inputId);
        if (!inputElement) {
             console.warn(`Validation: Input element with ID '${inputId}' not found.`);
             return;
        }
        // Tạo element lỗi nếu chưa có (giữ lại logic tạo của bạn nếu đã có)
        if (!errorElement && inputElement.parentElement) {
            const formGroup = inputElement.closest('.form-group');
            if (formGroup) {
                 errorElement = document.createElement('div');
                 errorElement.className = 'validation-error-message'; 
                 errorElement.id = inputId + '-error';
                 inputElement.insertAdjacentElement('afterend', errorElement);
            } else {
                inputElement.insertAdjacentHTML('afterend', `<span class="validation-error-message" id="${inputId}-error"></span>`);
                errorElement = document.getElementById(inputId + '-error');
            }
        }
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }

    function clearValidationErrors(form) {
        if (!form) return;
        form.querySelectorAll('.validation-error-message').forEach(el => {
            el.textContent = '';
            el.style.display = 'none';
        });
    }

     // --- CẬP NHẬT HÀM XEM TRƯỚC ẢNH KHI CHỌN TỆP ---
     // --- CẬP NHẬT HÀM XEM TRƯỚC ẢNH KHI CHỌN TỆP ---
    if (menuItemImageFileInput && imagePreview) {
        menuItemImageFileInput.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    imagePreview.src = e.target.result;
                    imagePreview.style.display = 'block';
                }
                reader.readAsDataURL(file);
            } else {
                imagePreview.style.display = 'none';
                imagePreview.src = '#';
            }
        });
    }

    // --- FETCH MENU ITEMS FROM API ---
    async function fetchMenuItems() {
        try {
            const response = await fetch('/admin/api/menu-items');
            const data = await response.json();
            if (data.success && Array.isArray(data.menu_items)) {
                allMenuItems = data.menu_items;
                applyFiltersAndSort();
            } else {
                if(eMenuTableBody) eMenuTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;">${data.message || 'Không tải được dữ liệu.'}</td></tr>`;
            }
        } catch (error) {
            if(eMenuTableBody) eMenuTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;">Lỗi kết nối máy chủ.</td></tr>`;
            console.error("Error fetching menu items:", error);
        }
    }

    // --- RENDER E-MENU TABLE ---
    function renderEMenuTable(itemsToRender) {
        if (!eMenuTableBody) {
            console.error("Không tìm thấy eMenuTableBody để render!");
            return;
        }
        
        eMenuTableBody.innerHTML = ''; 
        console.log(`Bắt đầu render bảng với ${itemsToRender ? itemsToRender.length : 0} món.`); // DEBUG

        if (!itemsToRender || itemsToRender.length === 0) {
            eMenuTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Không có món ăn/đồ uống nào.</td></tr>';
            return;
        }

        itemsToRender.forEach(item => {
            const row = eMenuTableBody.insertRow();
            // Backend trả về image_url_full đã được xử lý bởi url_for
            const imageUrl = item.image_url_full || '/static/images/placeholder-food.png';
            const descriptionShort = item.description ? (item.description.length > 50 ? item.description.substring(0, 50) + '...' : item.description) : 'N/A';
            
            // Log dữ liệu của từng item để kiểm tra tên key
            // console.log("Rendering item:", item); 

            row.innerHTML = `
                <td>${item.id}</td>
                <td><img src="${imageUrl}" alt="${item.name}" class="item-image-thumbnail" onerror="this.onerror=null;this.src='/static/images/placeholder-food.png';"></td>
                <td>${item.name || 'N/A'}</td>
                <td>${categoryNames[item.category] || item.category || 'N/A'}</td>
                <td>${(item.price_vnd || 0).toLocaleString('vi-VN')}</td>
                <td>${item.price_usd ? item.price_usd.toFixed(2) : 'N/A'}</td>
                <td class="item-description-short" title="${item.description || ''}">${descriptionShort}</td>
                <td class="btn-action-group">
                    <button class="btn btn-sm btn-edit-item" data-item-id="${item.id}"><i class="fas fa-edit"></i> Sửa</button>
                    <button class="btn btn-sm btn-delete-item" data-item-id="${item.id}"><i class="fas fa-trash"></i> Xóa</button>
                </td>
            `;
        });
        attachActionListenersToEMenuTable();
        console.log("Render bảng hoàn tất."); // DEBUG
    }

    // --- ATTACH ACTION LISTENERS TO E-MENU TABLE ---
    function attachActionListenersToEMenuTable() {
        if (!eMenuTableBody) return;
        eMenuTableBody.querySelectorAll('.btn-edit-item').forEach(btn => {
            btn.addEventListener('click', function() {
                const itemId = parseInt(this.dataset.itemId);
                openMenuItemModal("Chỉnh sửa món ăn/đồ uống", itemId);
            });
        });
        eMenuTableBody.querySelectorAll('.btn-delete-item').forEach(btn => {
            btn.addEventListener('click', async function() { // Chuyển thành async
                const itemId = parseInt(this.dataset.itemId);
                const itemName = allMenuItems.find(item => item.id === itemId)?.name || `ID ${itemId}`;
                 if (confirm(`Bạn có chắc chắn muốn xóa món '${itemName}' không?`)) {
                    try {
                        const response = await fetch(`/admin/api/menu-items/${itemId}`, { method: 'DELETE' });
                        const result = await response.json();
                        if (response.ok && result.success) {
                            alert(result.message || `Đã xóa món ID ${itemId}`);
                            fetchMenuItems(menuItemSearchInput.value.trim(), menuCategoryFilter.value); // Tải lại
                        } else {
                             alert("Lỗi khi xóa: " + (result.message || "Không thể xóa món."));
                        }
                    } catch (error) {
                        console.error("Lỗi khi xóa món ăn:", error);
                        alert("Lỗi kết nối khi xóa món ăn.");
                    }
                }
            });
        });
    }
    
    // --- IMAGE PREVIEW (Giữ nguyên) ---
    if (menuItemImageURLInput && imagePreview) {
        menuItemImageURLInput.addEventListener('input', function() {
            const url = this.value;
            if (url && isValidURL(url)) { // Chỉ hiện preview nếu có URL và hợp lệ
                imagePreview.src = url;
                imagePreview.style.display = 'block';
                imagePreview.onerror = function() { 
                    this.src = '/static/images/placeholder-food.png'; // Hoặc ẩn đi: this.style.display = 'none';
                };
            } else if (!url) { // Nếu URL rỗng thì ẩn preview
                imagePreview.style.display = 'none';
                imagePreview.src = '#'; // Reset src
            } else { // URL không hợp lệ (nhưng không rỗng)
                imagePreview.style.display = 'none'; // Hoặc hiển thị ảnh báo lỗi
            }
        });
    }

    // --- MODAL HANDLING (E-MENU ITEM FORM) ---
     async function openMenuItemModal(title = "Thêm món mới", itemIdToEdit = null) {
        if (!menuItemFormModal || !menuItemModalTitle || !menuItemForm) {
            console.error("Các element của Modal không tìm thấy!");
            return;
        }
        
        menuItemModalTitle.textContent = title;
        menuItemForm.reset(); 
        clearValidationErrors(menuItemForm); 
        if(imagePreview) {
            imagePreview.style.display = 'none';
            imagePreview.src = '#';
        }
        if(hiddenMenuItemId) hiddenMenuItemId.value = ''; 
        
        editingMenuItemId = itemIdToEdit; // QUAN TRỌNG: Đặt giá trị cho biến editingMenuItemId

        if (editingMenuItemId) { 
            // --- CHẾ ĐỘ SỬA ---
            console.log(`Chế độ Sửa. Đang tải dữ liệu cho item ID: ${editingMenuItemId}`);
            // Gán ID vào hidden input để form có thể truy cập
            if(hiddenMenuItemId) hiddenMenuItemId.value = editingMenuItemId;

            try {
                const response = await fetch(`/admin/api/menu-items/${editingMenuItemId}`);
                const data = await response.json();

                if (response.ok && data.success && data.menu_item) {
                    const itemData = data.menu_item;
                    console.log("Dữ liệu nhận được để sửa:", itemData);
                    
                    // Điền dữ liệu vào form
                    document.getElementById('menuItemName').value = itemData.name;
                    document.getElementById('menuItemCategory').value = itemData.category;
                    // document.getElementById('menuItemImageURL').value = itemData.image_url || ''; // Bỏ nếu dùng input file
                    document.getElementById('menuItemPriceVND').value = itemData.price_vnd;
                    document.getElementById('menuItemPriceUSD').value = itemData.price_usd || '';
                    document.getElementById('menuItemDescription').value = itemData.description || '';
                    
                    // Hiển thị ảnh hiện tại
                    if (itemData.image_url_full && imagePreview) {
                        imagePreview.src = itemData.image_url_full;
                        imagePreview.style.display = 'block';
                    }
                } else {
                    alert("Lỗi tải thông tin món: " + (data.message || "Không tìm thấy."));
                    closeMenuItemModal(); // Đóng modal nếu không tải được dữ liệu
                    return; 
                }
            } catch (error) { 
                console.error("Lỗi khi lấy chi tiết món ăn:", error);
                alert("Lỗi kết nối khi lấy chi tiết món ăn.");
                closeMenuItemModal();
                return;
            }
        }
        menuItemFormModal.style.display = 'flex';
    }

    function closeMenuItemModal() { /* ... giữ nguyên ... */ }
    // ... (event listeners cho các nút modal giữ nguyên) ...
    if (addMenuItemBtn) addMenuItemBtn.addEventListener('click', () => openMenuItemModal("Thêm món mới vào E-Menu"));
    if (closeMenuItemModalBtn) closeMenuItemModalBtn.addEventListener('click', closeMenuItemModal);
    if (cancelMenuItemFormBtn) cancelMenuItemFormBtn.addEventListener('click', closeMenuItemModal);
    window.addEventListener('click', (event) => { if (event.target == menuItemFormModal) closeMenuItemModal(); });


    // --- FORM SUBMISSION (CREATE/UPDATE MENU ITEM) ---
    // --- THAY THẾ TOÀN BỘ LOGIC SUBMIT FORM CŨ BẰNG LOGIC NÀY ---
     if (menuItemForm) {
        menuItemForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            clearValidationErrors(menuItemForm); 
            let isValid = true;

            const name = document.getElementById('menuItemName').value.trim();
            const category = document.getElementById('menuItemCategory').value;
            const imageFileInput = document.getElementById('menuItemImageFile'); // Đổi từ URL sang file
            const priceVND = document.getElementById('menuItemPriceVND').value;
            const priceUSD = document.getElementById('menuItemPriceUSD').value; // Lấy giá trị priceUSD
            const description = document.getElementById('menuItemDescription').value.trim();
            
            if (name === '') { displayValidationError('menuItemName', 'Tên món là bắt buộc.'); isValid = false; }
            if (category === '') { displayValidationError('menuItemCategory', 'Vui lòng chọn danh mục.'); isValid = false; }
            if (priceVND === '' || parseFloat(priceVND) < 0) { displayValidationError('menuItemPriceVND', 'Giá VND là bắt buộc và không được âm.'); isValid = false; }
            
            // THÊM VALIDATION CHO PRICE_USD
            if (priceUSD === '' || parseFloat(priceUSD) < 0) {
                displayValidationError('menuItemPriceUSD', 'Giá USD là bắt buộc và không được âm.');
                isValid = false;
            }
            
            if (!isValid) return;

            const formData = new FormData(menuItemForm);
            
            // Không cần tạo itemApiData nữa vì đã dùng FormData

            let url = '/admin/api/menu-items';
            let method = 'POST';

            if (editingMenuItemId) { 
                url = `/admin/api/menu-items/${editingMenuItemId}`;
                method = 'PUT';
            }

            try {
                const response = await fetch(url, {
                    method: method,
                    body: formData 
                });
                const result = await response.json();
                
                if (response.ok && result.success) {
                    alert(result.message || (editingMenuItemId ? "Cập nhật thành công!" : "Thêm món mới thành công!"));
                    fetchMenuItems(); 
                    closeMenuItemModal();
                } else {
                    alert("Lỗi: " + (result.message || "Thao tác không thành công."));
                }
            } catch (error) {
                console.error("Lỗi khi lưu món ăn:", error);
                alert("Lỗi kết nối máy chủ khi lưu món ăn.");
            }
        });
    }


     function closeMenuItemModal() {
        if (menuItemFormModal) {
            menuItemFormModal.style.display = 'none';
            console.log("E-Menu modal closed.");
        }
    }

    // --- GẮN SỰ KIỆN CHO CÁC NÚT ĐÓNG/MỞ MODAL ---

    // Mở modal khi nhấn "Thêm món mới" (Đã có, giữ nguyên)
    if (addMenuItemBtn) {
        addMenuItemBtn.addEventListener('click', () => openMenuItemModal("Thêm món mới vào E-Menu"));
    }

    // Đóng modal khi nhấn nút "X"
    if (closeMenuItemModalBtn) {
        closeMenuItemModalBtn.addEventListener('click', closeMenuItemModal);
    } else {
        console.warn("Element 'closeMenuItemModalBtn' not found.");
    }

    // Đóng modal khi nhấn nút "Hủy"
    if (cancelMenuItemFormBtn) {
        cancelMenuItemFormBtn.addEventListener('click', closeMenuItemModal);
    } else {
        console.warn("Element 'cancelMenuItemFormBtn' not found.");
    }

    // Đóng modal khi click ra vùng xám bên ngoài
    window.addEventListener('click', function(event) {
        if (event.target == menuItemFormModal) { 
            closeMenuItemModal();
        }
    });
    // --- Lọc và Tìm kiếm ---
    function filterAndSearchMenuItems() {
        const searchTerm = menuItemSearchInput ? menuItemSearchInput.value.trim() : '';
        const categoryTerm = menuCategoryFilter ? menuCategoryFilter.value : '';
        fetchMenuItems(searchTerm, categoryTerm); // Gọi API để lọc/tìm kiếm từ backend
    }

    if (applyMenuItemFilterBtn) applyMenuItemFilterBtn.addEventListener('click', filterAndSearchMenuItems);
    if (applyMenuItemFilterBtn) {
        applyMenuItemFilterBtn.addEventListener('click', applyFiltersAndSort);
    }
     // Optional: dynamic filtering on input/change
    if (menuItemSearchInput) {
        menuItemSearchInput.addEventListener('input', applyFiltersAndSort);
    }
    if (menuCategoryFilter) {
        menuCategoryFilter.addEventListener('change', applyFiltersAndSort);
    }
    if (menuItemSearchInput) {
        menuItemSearchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') filterAndSearchMenuItems();
        });
    }
    if (menuCategoryFilter) menuCategoryFilter.addEventListener('change', filterAndSearchMenuItems);
    
    // --- Khởi tạo ban đầu ---
    addSortEventListeners();
    fetchMenuItems(); // Tải danh sách món ăn từ API khi trang được load
    updateSortIcons();
});