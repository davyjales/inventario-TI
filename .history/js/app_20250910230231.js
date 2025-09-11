document.addEventListener('DOMContentLoaded', () => {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const reportTabs = document.querySelectorAll('.report-tab, .history-tab');

  function switchToTab(targetTab) {
    // Remove active class from all buttons and tabs
    tabButtons.forEach(btn => btn.classList.remove('active'));
    reportTabs.forEach(tab => {
      tab.classList.remove('active');
      tab.style.display = 'none';
    });

    // Add active class to target button and show corresponding tab
    const targetButton = document.querySelector(`.tab-btn[data-tab="${targetTab}"]`);
    if (targetButton) {
      targetButton.classList.add('active');
    }
    const activeTab = document.getElementById(targetTab);
    if (activeTab) {
      activeTab.classList.add('active');
      activeTab.style.display = 'block';
    }
  }

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');
      switchToTab(targetTab);
      // Update URL hash
      window.location.hash = targetTab;
    });
  });

  // Handle URL hash on page load
  const hash = window.location.hash.substring(1); // Remove the '#'
  if (hash === 'equipment-report' || hash === 'equipment-history') {
    // Navigate to consulta section
    const consultaLink = document.querySelector('.nav-link[href="#consulta"]');
    if (consultaLink) {
      consultaLink.click();
    }
    // Switch to the specific tab
    switchToTab(hash);
  } else {
    // Initialize tabs display with default
    const activeButton = document.querySelector('.tab-btn.active');
    if (activeButton) {
      const targetTab = activeButton.getAttribute('data-tab');
      switchToTab(targetTab);
    }
  }
});
