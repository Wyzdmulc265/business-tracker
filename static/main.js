document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebarClose = document.getElementById('sidebarClose');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const mainContent = document.getElementById('mainContent');

    const isSidebarOpen = localStorage.getItem('sidebarOpen') === 'true';
    if (isSidebarOpen) {
        sidebar.classList.add('active');
        sidebarOverlay.classList.add('active');
        mainContent.classList.add('sidebar-active');
    }

    function toggleSidebar() {
        const isActive = sidebar.classList.toggle('active');
        sidebarOverlay.classList.toggle('active');
        mainContent.classList.toggle('sidebar-active');
        localStorage.setItem('sidebarOpen', isActive);
    }

    function closeSidebar() {
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
        mainContent.classList.remove('sidebar-active');
        localStorage.setItem('sidebarOpen', 'false');
    }

    if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);
    if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
        setTimeout(() => {
            alert.style.transition = 'opacity 0.5s';
            alert.style.opacity = '0';
            setTimeout(() => alert.remove(), 500);
        }, 3000);
    });

    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
        tab.addEventListener('click', function(e) {
            if (this.tagName === 'A' || !this.hasAttribute('data-toggle')) {
                return;
            }
            const targetId = this.getAttribute('data-tab');
            if (!targetId) return;
            const parent = this.closest('.nav-tabs');
            if (parent) {
                parent.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                const tabContent = parent.parentElement.querySelectorAll('.nav-tab-content');
                tabContent.forEach(content => {
                    content.classList.remove('active');
                    if (content.id === targetId + '-tab') {
                        content.classList.add('active');
                    }
                });
            }
        });
    });

    const buttonTabs = document.querySelectorAll('.nav-tab[data-tab]');
    buttonTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const targetId = this.getAttribute('data-tab');
            const parent = this.closest('.nav-tabs');
            parent.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            document.querySelectorAll('.nav-tab-content').forEach(content => content.classList.remove('active'));
            const targetContent = document.getElementById(targetId + '-tab');
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
});
