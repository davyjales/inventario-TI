document.addEventListener('DOMContentLoaded', () => {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const reportTabs = document.querySelectorAll('.report-tab, .history-tab');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');

      // Remove active class from all buttons and tabs
      tabButtons.forEach(btn => btn.classList.remove('active'));
      reportTabs.forEach(tab => {
        tab.classList.remove('active');
        tab.style.display = 'none';
      });

      // Add active class to clicked button and show corresponding tab
      button.classList.add('active');
      const activeTab = document.getElementById(targetTab);
      if (activeTab) {
        activeTab.classList.add('active');
        activeTab.style.display = 'block';
      }
    });
  });

  // Initialize tabs display
  const activeButton = document.querySelector('.tab-btn.active');
  if (activeButton) {
    const targetTab = activeButton.getAttribute('data-tab');
    const activeTab = document.getElementById(targetTab);
    if (activeTab) {
      activeTab.classList.add('active');
      activeTab.style.display = 'block';
    }
  }
});
