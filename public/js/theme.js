document.addEventListener('DOMContentLoaded', () => {
  const currentTheme = localStorage.getItem('theme') || 'light';
  if (currentTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
});

function toggleTheme() {
  if (document.documentElement.classList.contains('dark')) {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
    showToast('Switched to Light Mode');
  } else {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
    showToast('Switched to Dark Mode');
  }
}
