// app/static/js/admin/script_admin_layout.js
document.addEventListener('DOMContentLoaded', function() {
    console.log("Admin Layout Script Loaded with Active Link Fix!");

    const sidebar = document.getElementById('adminSidebar');
    const mobileToggleBtn = document.getElementById('mobile-menu-toggle-btn');
    const mainContentForOverlay = document.querySelector('.admin-main-content');

    // --- Mobile Sidebar Open/Close Toggle ---
    if (mobileToggleBtn && sidebar) {
        mobileToggleBtn.addEventListener('click', function(event) {
            event.stopPropagation();
            sidebar.classList.toggle('open');
            if (mainContentForOverlay) {
                mainContentForOverlay.classList.toggle('sidebar-open-overlay');
            }
        });
    }
    
    document.addEventListener('click', function(event) {
        if (sidebar && sidebar.classList.contains('open') && window.innerWidth <= 768) {
            const isClickInsideSidebar = sidebar.contains(event.target);
            const isClickOnToggleButton = mobileToggleBtn ? mobileToggleBtn.contains(event.target) : false;
            if (!isClickInsideSidebar && !isClickOnToggleButton) {
                sidebar.classList.remove('open');
                if (mainContentForOverlay) {
                    mainContentForOverlay.classList.remove('sidebar-open-overlay');
                }
            }
        }
    });

    // <<< BẮT ĐẦU PHẦN LOGIC ĐƯỢC CẬP NHẬT >>>
    // --- Sidebar Active Link ---
    const currentLocation = window.location.pathname;
    const sidebarLinks = document.querySelectorAll('.sidebar-nav a');

    let isLinkActivated = false;

    // Xóa tất cả các class active trước khi xử lý
    document.querySelectorAll('.sidebar-nav li').forEach(li => {
        li.classList.remove('active');
    });

    sidebarLinks.forEach(link => {
        const linkHref = link.getAttribute('href');
        // So sánh chính xác href với pathname
        if (linkHref === currentLocation) {
            link.parentElement.classList.add('active');
            isLinkActivated = true;

            // Nếu đây là một mục trong submenu, mở cả submenu cha
            const parentSubmenu = link.closest('.submenu');
            if (parentSubmenu) {
                const parentHasSubmenu = parentSubmenu.closest('.has-submenu');
                if (parentHasSubmenu) {
                    parentHasSubmenu.classList.add('open');
                }
            }
        }
    });

    // Xử lý trường hợp đặc biệt cho dashboard (nếu URL là /admin/ hoặc /admin)
    if (!isLinkActivated && (currentLocation === '/admin/' || currentLocation === '/admin')) {
        const dashboardLink = document.querySelector('.sidebar-nav a[href$="/dashboard"]');
        if (dashboardLink) {
            dashboardLink.parentElement.classList.add('active');
        }
    }
    // <<< KẾT THÚC PHẦN LOGIC ĐƯỢC CẬP NHẬT >>>


    // --- Sidebar Submenu Toggle ---
    const submenuToggles = document.querySelectorAll('.sidebar-nav .has-submenu > a');
    submenuToggles.forEach(toggle => {
        toggle.addEventListener('click', function(event) {
            event.preventDefault();
            const parentLi = this.parentElement;
            parentLi.classList.toggle('open');
        });
    });

    // --- Xử lý Logout ---
    const logoutButton = document.querySelector('.logout-btn');
    if (logoutButton) {
        logoutButton.addEventListener('click', async function(e) {
            e.preventDefault();
            if (confirm("Bạn có chắc chắn muốn đăng xuất không?")) {
                try {
                    const response = await fetch('/api/auth/logout', { method: 'POST' });
                    const result = await response.json();

                    if (response.ok && result.success) {
                        alert(result.message || "Đăng xuất thành công!");
                        window.location.href = '/dang-nhap';
                    } else {
                        alert("Lỗi đăng xuất: " + (result.message || "Không thể đăng xuất."));
                    }
                } catch (error) {
                    console.error("Lỗi khi thực hiện đăng xuất:", error);
                    alert("Có lỗi kết nối xảy ra khi đăng xuất. Vui lòng thử lại.");
                }
            }
        });
    }
});