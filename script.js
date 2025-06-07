// Show content box by id and activate corresponding button (if needed)
function showContent(id) {
  const allBoxes = document.querySelectorAll('.content-box');
  allBoxes.forEach(box => box.classList.remove('visible'));

  const targetBox = document.getElementById(id);
  if (targetBox) {
    targetBox.classList.add('visible');
  }

  const buttons = document.querySelectorAll('.care-btn');
  buttons.forEach(btn => btn.classList.remove('active'));

  const clickedBtn = Array.from(buttons).find(btn => btn.getAttribute('onclick')?.includes(id));
  if (clickedBtn) {
    clickedBtn.classList.add('active');
  }
}

// Handle form submission once
document.getElementById('period-form').addEventListener('submit', function (e) {
  e.preventDefault();

  const startInput = document.getElementById('start-date').value;
  const endInput = document.getElementById('end-date').value;

  if (!startInput || !endInput) {
    alert("Please enter both start and end dates!");
    return;
  }

  const startDate = new Date(startInput);
  const endDate = new Date(endInput);

  if (isNaN(startDate) || isNaN(endDate) || startDate > endDate) {
    alert("Please enter valid dates, and ensure start date is before end date 🥲");
    return;
  }

  const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

  // Show summary
  const summary = `
    <p>🌸 Cycle Length: <strong>${days} days</strong></p>
    <p>🌿 Start: ${startDate.toDateString()}</p>
    <p>🌼 End: ${endDate.toDateString()}</p>
  `;
  document.getElementById('tracker-summary').innerHTML = summary;

  renderCalendar(startDate, endDate);
  generateGraph(startDate, endDate);
});

// Render calendar with period days highlighted
function renderCalendar(start, end) {
  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  for (let i = 1; i <= daysInMonth; i++) {
    const current = new Date(year, month, i);
    const cell = document.createElement('div');
    cell.classList.add('calendar-cell');

    if (current >= start && current <= end) {
      cell.style.background = "#ffb3d9";
      cell.innerHTML = `🩸<br>${i}`;
    } else {
      cell.innerText = i;
    }

    grid.appendChild(cell);
  }
}

// Generate hormone & mood graph for the logged period
function generateGraph(startDate, endDate) {
  const days = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

  const labels = [];
  const estrogen = [];
  const progesterone = [];
  const mood = [];

  for (let i = 0; i < days; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + i);
    labels.push(currentDate.toLocaleDateString());

    // Hormone levels simulation
    let eLevel, pLevel, moodLevel;

    if (i < 5) {
      eLevel = 20 + i * 5;
      pLevel = 10;
      moodLevel = 3;
    } else if (i < 13) {
      eLevel = 40 + (i - 5) * 8;
      pLevel = 15;
      moodLevel = 6;
    } else if (i < 16) {
      eLevel = 120;
      pLevel = 25;
      moodLevel = 8;
    } else if (i < 25) {
      eLevel = 60 - (i - 16) * 4;
      pLevel = 30 + (i - 16) * 2;
      moodLevel = 4;
    } else {
      eLevel = 30;
      pLevel = 10;
      moodLevel = 2;
    }

    estrogen.push(eLevel);
    progesterone.push(pLevel);
    mood.push(moodLevel);
  }

  if (window.hormoneChartInstance) {
    window.hormoneChartInstance.destroy();
  }

  const ctx = document.getElementById("hormoneChart").getContext("2d");
  window.hormoneChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Estrogen",
          data: estrogen,
          borderColor: "#ff69b4",
          backgroundColor: "rgba(255,105,180,0.1)",
          tension: 0.4,
          fill: true,
        },
        {
          label: "Progesterone",
          data: progesterone,
          borderColor: "#8a2be2",
          backgroundColor: "rgba(138,43,226,0.1)",
          tension: 0.4,
          fill: true,
        },
        {
          label: "Mood (1-10)",
          data: mood,
          borderColor: "#ff9900",
          backgroundColor: "rgba(255,153,0,0.1)",
          tension: 0.4,
          fill: false,
          borderDash: [5, 5],
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  });
}







function showContent(id) {
  const boxes = document.querySelectorAll('.content-box');
  const buttons = document.querySelectorAll('.care-btn');

  boxes.forEach(box => {
    box.classList.remove('visible');
  });

  buttons.forEach(btn => {
    btn.classList.remove('active');
  });

  document.getElementById(id).classList.add('visible');
  event.target.classList.add('active');
}

