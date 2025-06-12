// app/static/js/admin/script_quan_ly_nguoi_dung.js
document.addEventListener('DOMContentLoaded', function() {
    console.log("User Management Script Loaded - API Integrated!");

    const addUserBtn = document.getElementById('addUserBtn');
    const userFormModal = document.getElementById('userFormModal');
    const closeUserModalBtn = document.getElementById('closeUserModalBtn');
    const userForm = document.getElementById('userForm');
    const userModalTitle = document.getElementById('userModalTitle');
    const usersTableBody = document.getElementById('usersTableBody');
    const cancelUserFormBtn = document.getElementById('cancelUserFormBtn');
    const userSearchInput = document.getElementById('userSearchInput');
    const userStatusFilter = document.getElementById('userStatusFilter'); // Select để lọc status
    const applyUserFilterBtn = document.getElementById('applyUserFilterBtn');
    const hiddenUserId = document.getElementById('userId'); // Hidden input for user ID in form

    let editingUserId = null;
    let allUsersData = []; // Để lưu trữ dữ liệu người dùng từ API
    let currentSortColumn = 'id'; // Mặc định sắp xếp theo ID
    let currentSortDirection = 'asc'; // Mặc định tăng dần


    // Mapping trạng thái (giữ nguyên)
    const statusUserMapping = {
        "active": { text: "Hoạt động", class: "status-active" },
        "locked": { text: "Bị khóa", class: "status-locked" },
        "pending": { text: "Chờ kích hoạt", class: "status-pending" }
    };

     function updateSortIcons() {
        document.querySelectorAll('#usersTable th[data-sort-by]').forEach(th => {
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
        const sortedArray = [...dataArray]; 
        sortedArray.sort((a, b) => {
            // Sử dụng key từ mock data của bạn: 'fullName', 'registeredDate', 'status'
            let valA = a[column];
            let valB = b[column];

            if (valA === null || valA === undefined) return 1;
            if (valB === null || valB === undefined) return -1;

            if (typeof valA === 'string') {
                // Đối với ngày tháng dạng YYYY-MM-DD, so sánh chuỗi là đủ
                return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            if (typeof valA === 'number') {
                return direction === 'asc' ? valA - valB : valB - valA;
            }
            return 0;
        });
        return sortedArray;
    }

    function applyFiltersAndSort() {
        let filteredUsers = [...allUsersData];

        // Áp dụng bộ lọc (giữ nguyên logic lọc của bạn)
        const searchTerm = userSearchInput ? userSearchInput.value.toLowerCase().trim() : '';
        const statusTerm = userStatusFilter ? userStatusFilter.value : '';

        if (searchTerm) {
            filteredUsers = filteredUsers.filter(user =>
                (user.fullName && user.fullName.toLowerCase().includes(searchTerm)) ||
                (user.email && user.email.toLowerCase().includes(searchTerm)) ||
                (user.phone && user.phone.includes(searchTerm))
            );
        }
        if (statusTerm) {
            filteredUsers = filteredUsers.filter(user => user.status === statusTerm);
        }

        // Áp dụng sắp xếp
        const sortedAndFiltered = sortData(filteredUsers, currentSortColumn, currentSortDirection);
        renderUsersTable(sortedAndFiltered);
    }

    function addSortEventListeners() {
        document.querySelectorAll('#usersTable th[data-sort-by]').forEach(headerCell => {
            headerCell.style.cursor = 'pointer';
            headerCell.addEventListener('click', () => {
                const sortKey = headerCell.dataset.sortBy;
                if (currentSortColumn === sortKey) {
                    currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSortColumn = sortKey;
                    currentSortDirection = 'desc';
                }
                updateSortIcons();
                applyFiltersAndSort();
            });
        });
    }

    // --- Helper Functions for Validation (giữ nguyên) ---
    function displayValidationError(inputId, message) { /* ... giữ nguyên ... */ 
        let errorElement = document.getElementById(inputId + '-error');
        const inputElement = document.getElementById(inputId);
        if (!inputElement) return;

        if (!errorElement && inputElement.parentElement) {
            // Tạo một div mới cho thông báo lỗi nếu chưa có
            const formGroup = inputElement.closest('.form-group'); // Tìm .form-group gần nhất
            if (formGroup) {
                 errorElement = document.createElement('div');
                 errorElement.className = 'validation-error-message'; 
                 errorElement.id = inputId + '-error';
                 // Chèn vào trong .form-group, sau input
                 inputElement.insertAdjacentElement('afterend', errorElement);
            } else { // Fallback nếu không có .form-group
                inputElement.insertAdjacentHTML('afterend', `<div class="validation-error-message" id="${inputId}-error"></div>`);
                errorElement = document.getElementById(inputId + '-error');
            }
        }
        if (errorElement) {
            errorElement.textContent = message;
        }
    }
    function clearValidationErrors(form) { /* ... giữ nguyên ... */ 
        form.querySelectorAll('.validation-error-message').forEach(el => el.textContent = '');
    }
    function isValidEmail(email) { /* ... giữ nguyên ... */ 
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    function isValidPhone(phone) { /* ... giữ nguyên ... */ 
        if (!phone) return true; 
        const phoneRegex = /^0\d{9,10}$/;
        return phoneRegex.test(phone);
    }

    // --- FETCH USERS FROM API ---
    async function fetchUsers() {
        const searchTerm = userSearchInput ? userSearchInput.value.trim() : '';
        const statusTerm = userStatusFilter ? userStatusFilter.value : '';
        
        let apiUrl = '/admin/api/users?';
        const params = new URLSearchParams();
        if (searchTerm) params.append('search', searchTerm);
        if (statusTerm) params.append('status', statusTerm);
        apiUrl += params.toString();

        try {
            const response = await fetch(apiUrl);
            const data = await response.json();
            if (data.success && Array.isArray(data.users)) {
                allUsersData = data.users;
                applyFiltersAndSort();
            } else {
                if(usersTableBody) usersTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">${data.message || 'Không tải được dữ liệu người dùng.'}</td></tr>`;
            }
        } catch (error) {
            if(usersTableBody) usersTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Lỗi kết nối máy chủ.</td></tr>`;
        }
    }

    // --- RENDER USERS TABLE ---
    function renderUsersTable(usersToRender) {
        if (!usersTableBody) return;
        usersTableBody.innerHTML = ''; 
        if (!usersToRender || usersToRender.length === 0) {
            usersTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Không có người dùng nào.</td></tr>';
            return;
        }
        usersToRender.forEach(user => {
            const row = usersTableBody.insertRow();
            const statusInfo = statusUserMapping[user.status] || { text: user.status, class: '' };
            const lockButtonText = user.status === 'locked' ? 'Mở khóa' : 'Khóa';
            const lockButtonClass = user.status === 'locked' ? 'unlock' : ''; // Thêm class 'unlock' nếu cần style riêng
            // registered_date được trả về từ API (model đã format)
            row.innerHTML = `
                <td>${user.id}</td>
                <td>${user.full_name || 'N/A'}</td>
                <td>${user.email || 'N/A'}</td>
                <td>${user.phone_number || 'N/A'}</td>
                <td>${user.registered_date || 'N/A'}</td> 
                <td><span class="status-user ${statusInfo.class}">${statusInfo.text}</span></td>
                <td class="btn-action-group">
                    <button class="btn btn-sm btn-edit-user" data-user-id="${user.id}"><i class="fas fa-edit"></i> Sửa</button>
                    <button class="btn btn-sm btn-lock-user ${lockButtonClass}" data-user-id="${user.id}" data-current-status="${user.status}"><i class="fas ${user.status === 'locked' ? 'fa-unlock' : 'fa-lock'}"></i> ${lockButtonText}</button>
                    <button class="btn btn-sm btn-delete-user" data-user-id="${user.id}"><i class="fas fa-trash"></i> Xóa</button>
                </td>
            `;
        });
        attachActionListenersToUserTable();
    }

    // --- ATTACH ACTION LISTENERS TO USER TABLE ---
    function attachActionListenersToUserTable() {
        if (!usersTableBody) return;
        usersTableBody.querySelectorAll('.btn-edit-user').forEach(btn => {
            btn.addEventListener('click', function() {
                const userId = parseInt(this.dataset.userId);
                openUserModal("Chỉnh sửa thông tin người dùng", userId);
            });
        });

        usersTableBody.querySelectorAll('.btn-lock-user').forEach(btn => {
            btn.addEventListener('click', async function() { // Chuyển thành async
                const userId = parseInt(this.dataset.userId);
                const currentStatus = this.dataset.currentStatus;
                const newStatus = currentStatus === 'locked' ? 'active' : 'locked';
                const actionText = currentStatus === 'locked' ? 'mở khóa' : 'khóa';
                
                if (confirm(`Bạn có chắc chắn muốn ${actionText} tài khoản người dùng ID ${userId} không?`)) {
                    try {
                        const response = await fetch(`/admin/api/users/${userId}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: newStatus }) // API sẽ map userStatus sang status
                        });
                        const result = await response.json();
                        if (response.ok && result.success) {
                            alert(`Đã ${actionText} tài khoản ID ${userId}.`);
                            fetchUsers(userSearchInput.value.trim(), userStatusFilter.value); 
                        } else {
                            alert("Lỗi: " + (result.message || `Không thể ${actionText} tài khoản.`));
                        }
                    } catch (error) {
                        console.error(`Lỗi khi ${actionText} tài khoản:`, error);
                        alert(`Lỗi kết nối khi ${actionText} tài khoản.`);
                    }
                }
            });
        });

        usersTableBody.querySelectorAll('.btn-delete-user').forEach(btn => {
            btn.addEventListener('click', async function() { // Chuyển thành async
                const userId = parseInt(this.dataset.userId);
                 if (confirm(`Bạn có chắc chắn muốn XÓA VĨNH VIỄN người dùng ID ${userId} không? Thao tác này không thể hoàn tác!`)) {
                    try {
                        const response = await fetch(`/admin/api/users/${userId}`, { method: 'DELETE' });
                        const result = await response.json();
                        if (response.ok && result.success) {
                            alert(result.message || `Đã xóa người dùng ID ${userId}`);
                            fetchUsers(userSearchInput.value.trim(), userStatusFilter.value); // Tải lại
                        } else {
                             alert("Lỗi khi xóa: " + (result.message || "Không thể xóa người dùng."));
                        }
                    } catch (error) {
                        console.error("Lỗi khi xóa người dùng:", error);
                        alert("Lỗi kết nối khi xóa người dùng.");
                    }
                }
            });
        });
    }

    // --- MODAL HANDLING (USER FORM) ---
    async function openUserModal(title = "Thêm người dùng mới", userIdToEdit = null) {
        if (!userFormModal || !userModalTitle || !userForm) return;
        userModalTitle.textContent = title;
        userForm.reset(); 
        clearValidationErrors(userForm); 
        hiddenUserId.value = ''; 
        editingUserId = userIdToEdit;

        const passwordInput = document.getElementById('userPassword'); 

        if (userIdToEdit) { 
            // Chế độ sửa: Lấy dữ liệu user từ API
            try {
                const response = await fetch(`/admin/api/users/${userIdToEdit}`);
                const data = await response.json();
                if (data.success && data.user) {
                    const userData = data.user;
                    hiddenUserId.value = userData.id;
                    document.getElementById('userFullName').value = userData.full_name;
                    document.getElementById('userEmail').value = userData.email;
                    document.getElementById('userPhone').value = userData.phone_number || '';
                    document.getElementById('userStatus').value = userData.status;
                    // Cân nhắc thêm trường role vào form nếu admin được phép sửa role
                    // document.getElementById('userRole').value = userData.role; 
                    if (passwordInput) passwordInput.placeholder = "Để trống nếu không đổi mật khẩu";
                } else {
                    alert("Lỗi tải thông tin người dùng: " + (data.message || "Không tìm thấy người dùng."));
                    return;
                }
            } catch (error) {
                console.error("Lỗi khi lấy chi tiết người dùng:", error);
                alert("Lỗi kết nối khi lấy chi tiết người dùng.");
                return;
            }
        } else { 
            // Chế độ thêm mới
            if (passwordInput) passwordInput.placeholder = "Nhập mật khẩu (ít nhất 6 ký tự)";
            // Có thể đặt giá trị mặc định cho role và status ở đây nếu form có
            // document.getElementById('userRole').value = 'client';
            document.getElementById('userStatus').value = 'active';
        }
        userFormModal.style.display = 'flex';
    }

    function closeUserModal() { /* ... giữ nguyên ... */ 
        if (userFormModal) userFormModal.style.display = 'none';
    }
    if (addUserBtn) addUserBtn.addEventListener('click', () => openUserModal("Thêm người dùng mới"));
    if (closeUserModalBtn) closeUserModalBtn.addEventListener('click', closeUserModal);
    if (cancelUserFormBtn) cancelUserFormBtn.addEventListener('click', closeUserModal);
    window.addEventListener('click', (event) => { /* ... giữ nguyên ... */ 
        if (event.target == userFormModal) closeUserModal();
    });

    // --- FORM SUBMISSION (CREATE/UPDATE USER) ---
    if (userForm) {
        userForm.addEventListener('submit', async function(event) { // Chuyển thành async
            event.preventDefault();
            clearValidationErrors(userForm); 
            let isValid = true;

            const fullName = document.getElementById('userFullName').value.trim();
            const email = document.getElementById('userEmail').value.trim();
            const phone = document.getElementById('userPhone').value.trim();
            const status = document.getElementById('userStatus').value;
            const password = document.getElementById('userPassword').value; 
            // const role = document.getElementById('userRole').value; // Lấy role nếu có trường này trên form

            // --- Client-side validation (giữ lại hoặc cải thiện) ---
            if (fullName === '') { 
            displayValidationError('userFullName','Họ và tên là bắt buộc.'); 
            isValid = false; 
            }
            if (email === '') { 
                displayValidationError('userEmail','Email là bắt buộc.'); 
                isValid = false; 
            } else if (!isValidEmail(email)) { 
                displayValidationError('userEmail','Định dạng email không hợp lệ.'); 
                isValid = false; 
            }
            
            if (phone !== '' && !isValidPhone(phone)) { 
                displayValidationError('userPhone','Số điện thoại không hợp lệ (VD: 09xxxxxxxx).'); 
                isValid = false; 
            }

            // Mật khẩu là bắt buộc khi thêm mới (editingUserId là null)
            if (!editingUserId && password === '') { 
                displayValidationError('userPassword', 'Mật khẩu là bắt buộc khi thêm người dùng mới.'); 
                isValid = false;
            } else if (password !== '' && password.length < 6) { // Kiểm tra độ dài nếu có nhập mật khẩu
                displayValidationError('userPassword', 'Mật khẩu phải có ít nhất 6 ký tự.'); 
                isValid = false;
            }
            
            if (!isValid) {
                console.log("Client-side validation failed."); // Thêm log để biết
                return; 
            }

            const userApiData = { 
                full_name: fullName,
                email: email,
                phone_number: phone,
                status: status,
            };
            if (password) { // Chỉ gửi mật khẩu nếu được nhập
                userApiData.password = password;
            }

            let url = '/admin/api/users';
            let method = 'POST';

            if (editingUserId) { 
                url = `/admin/api/users/${editingUserId}`;
                method = 'PUT';
            }

            try {
                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(userApiData)
                });
                const result = await response.json(); // Luôn cố gắng parse JSON

                console.log("API Response:", response.status, result); // << THÊM LOG NÀY

                if (response.ok && result.success) {
                    alert(result.message || (editingUserId ? "Cập nhật thành công!" : "Thêm người dùng thành công!"));
                    fetchUsers(userSearchInput.value.trim(), userStatusFilter.value); 
                    closeUserModal();
                } 
                else {
                    alert("Lỗi: " + (result.message || "Thao tác không thành công."));
                    // Hiển thị lỗi chi tiết hơn nếu API trả về (ví dụ, nếu result.errors là một object)
                    if (result.errors) { 
                        for (const fieldKeyInError in result.errors) {
                            // Cần map key lỗi từ backend về ID của input error span
                            // Ví dụ, nếu backend trả về lỗi cho key 'email', và span lỗi là 'userEmail-error'
                            let errorSpanId = '';
                            if (fieldKeyInError.toLowerCase().includes('email')) errorSpanId = 'userEmail';
                            else if (fieldKeyInError.toLowerCase().includes('fullname')) errorSpanId = 'userFullName';
                            else if (fieldKeyInError.toLowerCase().includes('phone')) errorSpanId = 'userPhone';
                            else if (fieldKeyInError.toLowerCase().includes('password')) errorSpanId = 'userPassword';
                            // ... thêm các mapping khác nếu cần ...
                            if (errorSpanId) displayValidationError(errorSpanId, result.errors[fieldKeyInError]);
                        }
                    }
                }
            } 
            catch (error) {
                console.error("Lỗi khi lưu người dùng (catch block):", error);
                alert("Lỗi kết nối máy chủ hoặc lỗi xử lý phản hồi khi lưu người dùng.");
            }
        });
    }

    // --- Lọc và Tìm kiếm Người dùng ---
    function filterAndSearchUsers() {
        const searchTerm = userSearchInput ? userSearchInput.value.trim() : '';
        const statusTerm = userStatusFilter ? userStatusFilter.value : '';
        fetchUsers(searchTerm, statusTerm); // Gọi API với tham số lọc
    }

    if (applyUserFilterBtn) applyUserFilterBtn.addEventListener('click', filterAndSearchUsers);
    // Có thể thêm listener cho 'input' của userSearchInput để tìm kiếm động
    if (applyUserFilterBtn) applyUserFilterBtn.addEventListener('click', fetchUsers);
    if (userSearchInput) {
        userSearchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') fetchUsers();
        });
    }
    // Logic lọc tự động khi thay đổi select
    if (userStatusFilter) userStatusFilter.addEventListener('change', fetchUsers);
    
    if (userSearchInput) {
        userSearchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                filterAndSearchUsers();
            }
        });
    }
    if (userStatusFilter) userStatusFilter.addEventListener('change', filterAndSearchUsers);
    
    // --- Khởi tạo ban đầu ---
    addSortEventListeners();
    fetchUsers();
    updateSortIcons();
});