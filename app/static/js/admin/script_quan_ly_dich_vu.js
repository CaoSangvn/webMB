// app/static/js/admin/script_quan_ly_dich_vu.js
document.addEventListener('DOMContentLoaded', function() {
    console.log("Service Management Script Loaded!");

    const addServiceBtn = document.getElementById('addServiceBtn');
    const modal = document.getElementById('serviceFormModal');
    const closeModalBtn = document.getElementById('closeServiceModalBtn');
    const cancelFormBtn = document.getElementById('cancelServiceFormBtn');
    const serviceForm = document.getElementById('serviceForm');
    const modalTitle = document.getElementById('serviceModalTitle');
    const tableBody = document.getElementById('servicesTableBody');
    const hiddenServiceId = document.getElementById('serviceId');

    let editingServiceId = null;

    const fetchAndRenderServices = async () => {
        try {
            const response = await fetch('/admin/api/services');
            const data = await response.json();
            if (data.success) {
                renderTable(data.services);
            } else {
                alert('Lỗi khi tải danh sách dịch vụ: ' + data.message);
            }
        } catch (error) {
            console.error('Error fetching services:', error);
            alert('Lỗi kết nối máy chủ.');
        }
    };
    const categoryLabels = {
        baggage:                 "Hành lý",
        seat_preference:         "Chọn ghế",
        insurance:               "Bảo hiểm",
        priority_services:       "Dịch vụ ưu tiên",
        airport_transfer:        "Đưa đón sân bay",
        in_flight_entertainment: "Giải trí trên chuyến bay"
    };

    const renderTable = (services) => {
        tableBody.innerHTML = '';
        if (!services || services.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Chưa có dịch vụ nào được tạo.</td></tr>';
            return;
        }
        services.forEach(service => {
            const row = document.createElement('tr');
            const description = service.description || '';
            // Lấy label thân thiện
            const categoryLabel = categoryLabels[service.category] || service.category;

            row.innerHTML = `
                <td>${service.id}</td>
                <td>${service.name}</td>
                <td>${categoryLabel}</td>
                <td>${(service.price_vnd || 0).toLocaleString('vi-VN')}</td>
                <td title="${description}">
                ${description.substring(0, 40)}${description.length > 40 ? '...' : ''}
                </td>
                <td>
                ${ service.is_available
                    ? '<span style="color:green; font-weight:bold;">Khả dụng</span>'
                    : '<span style="color:red;">Không</span>'
                }
                </td>
                <td class="btn-action-group">
                    <button class="btn btn-sm btn-edit-item" data-id="${service.id}">
                    <i class="fas fa-edit"></i> Sửa
                    </button>
                    <button class="btn btn-sm btn-delete-item" data-id="${service.id}">
                    <i class="fas fa-trash"></i> Xóa
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    };

    
    const openModal = async (serviceId = null) => {
        serviceForm.reset();
        editingServiceId = serviceId;
        hiddenServiceId.value = '';

        if (serviceId) {
            modalTitle.textContent = 'Chỉnh sửa Dịch vụ';
            try {
                const response = await fetch(`/admin/api/services/${serviceId}`);
                const result = await response.json();
                if (result.success) {
                    const service = result.service;
                    hiddenServiceId.value = service.id;
                    document.getElementById('serviceName').value = service.name;
                    document.getElementById('serviceCategory').value = service.category;
                    document.getElementById('servicePriceVND').value = service.price_vnd;
                    document.getElementById('servicePriceUSD').value = service.price_usd || '';
                    document.getElementById('serviceDescription').value = service.description || '';
                    document.getElementById('serviceConditions').value = service.conditions || '';
                    document.getElementById('serviceIsAvailable').value = service.is_available ? '1' : '0';
                } else {
                    alert("Lỗi: " + result.message);
                    return;
                }
            } catch (error) {
                alert("Lỗi kết nối khi tải chi tiết dịch vụ.");
                return;
            }
        } else {
            modalTitle.textContent = 'Thêm Dịch vụ mới';
        }
        modal.style.display = 'flex';
    };

    const closeModal = () => {
        modal.style.display = 'none';
    };

    addServiceBtn.addEventListener('click', () => openModal());
    closeModalBtn.addEventListener('click', closeModal);
    cancelFormBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    serviceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(serviceForm);
        const data = {};
        formData.forEach((value, key) => data[key] = value);
        data.is_available = document.getElementById('serviceIsAvailable').value;

        const url = editingServiceId ? `/admin/api/services/${editingServiceId}` : '/admin/api/services';
        const method = editingServiceId ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (result.success) {
                alert(result.message);
                closeModal();
                fetchAndRenderServices();
            } else {
                alert('Lỗi: ' + result.message);
            }
        } catch (error) {
            console.error('Error saving service:', error);
            alert('Lỗi kết nối máy chủ.');
        }
    });

    tableBody.addEventListener('click', async (e) => {
        const button = e.target.closest('button');
        if (!button) return;

        const serviceId = button.dataset.id;

        if (button.classList.contains('btn-edit-item')) {
            openModal(serviceId);
        }

        if (button.classList.contains('btn-delete-item')) {
            if (confirm(`Bạn có chắc muốn xóa dịch vụ có ID ${serviceId} không?`)) {
                try {
                    const response = await fetch(`/admin/api/services/${serviceId}`, { method: 'DELETE' });
                    const result = await response.json();
                    if (result.success) {
                        alert(result.message);
                        fetchAndRenderServices();
                    } else {
                        alert('Lỗi: ' + result.message);
                    }
                } catch (error) {
                    alert('Lỗi kết nối máy chủ.');
                }
            }
        }
    });

    fetchAndRenderServices();
});