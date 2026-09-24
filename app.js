(() => {
  const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const VENUES = [{ key: 'light', name: 'Лайт', mark: 'mark-light' }, { key: 'light2', name: 'Лайт 2', mark: 'mark-light2' }, { key: 'atmos', name: 'Атмосфера', mark: 'mark-atmos' }];
  const STORAGE_KEY = 'grafik-scheduler-v1';
  const today = new Date();
  const initialMonday = mondayOf(today);
  let state = loadState();
  let period = 'week';
  let toastTimer;

  function mondayOf(date) { const d = new Date(date); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; }
  function dateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
  function shiftDate(date, amount) { const d = new Date(date); d.setDate(d.getDate() + amount); return d; }
  function formatDate(date, options = { day: 'numeric', month: 'short' }) { return new Intl.DateTimeFormat('ru-RU', options).format(date).replace(' г.', ''); }
  function makeWeek() { const availability = {}; for (let i = 0; i < 8; i++) availability[i] = Array(7).fill(false); return { availability, schedule: null, history: Array.from({ length: 8 }, () => ({ shifts: 0, value: 0, support: 0 })) }; }
  function defaultState() { return { employees: ['Анна', 'Мария', 'Алексей', 'Ирина', 'Дмитрий', 'Екатерина', 'Сергей', 'Ольга'], weeks: {}, history: {} }; }
  function loadState() { try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); if (saved && Array.isArray(saved.employees) && saved.employees.length === 8) return { ...defaultState(), ...saved }; } catch (_) {} return defaultState(); }
  function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function weekKey(start) { return dateKey(start); }
  function getWeek(start) { const key = weekKey(start); if (!state.weeks[key]) state.weeks[key] = makeWeek(); return state.weeks[key]; }
  function currentStart() { return currentDate; }
  let currentDate = initialMonday;
  function labelName(name) { const parts = name.trim().split(/\s+/); return parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0]; }
  function safeText(value) { const span = document.createElement('span'); span.textContent = value; return span.innerHTML; }
  function showToast(message) { const toast = document.getElementById('toast'); toast.textContent = message; toast.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600); }
  function getDates(start) { return Array.from({ length: 7 }, (_, i) => shiftDate(start, i)); }
  function getWeekSchedule(week) { return week.schedule || { main: VENUES.reduce((result, venue) => (result[venue.key] = Array(7).fill(null), result), {}), support: Array(7).fill(null) }; }

  function render() {
    const week = getWeek(currentStart());
    const dates = getDates(currentStart());
    document.getElementById('weekLabel').textContent = `${formatDate(dates[0])} — ${formatDate(dates[6], { day: 'numeric', month: 'long', year: 'numeric' })}`;
    renderAvailability(week, dates);
    renderSchedule(week, dates);
    renderSupport(week, dates);
    renderStats(week);
    renderWorkload(week);
    const alerts = countOpen(getWeekSchedule(week));
    document.getElementById('navAlerts').textContent = alerts;
    document.getElementById('navAlerts').style.display = alerts ? '' : 'none';
    const approved = Boolean(week.schedule && week.schedule.approved);
    document.getElementById('approvalStatus').className = `status-pill ${approved ? 'status-approved' : 'status-draft'}`;
    document.getElementById('approvalStatus').innerHTML = `<i></i>${approved ? 'Подтверждён' : 'Черновик'}`;
    document.getElementById('approveButton').textContent = approved ? 'Снять подтверждение' : 'Подтвердить график';
  }

  function renderAvailability(week, dates) {
    document.getElementById('availabilityHead').innerHTML = `<tr><th>СОТРУДНИК</th>${dates.map((date, i) => `<th>${DAYS[i]}<span class="weekday-date">${formatDate(date, { day: 'numeric', month: 'short' })}</span></th>`).join('')}</tr>`;
    document.getElementById('availabilityBody').innerHTML = state.employees.map((name, employee) => `<tr><td>${safeText(name)}</td>${DAYS.map((_, day) => `<td><input class="availability-check" type="checkbox" aria-label="${safeText(name)}, ${DAYS[day]} — ${formatDate(dates[day])}" data-employee="${employee}" data-day="${day}" ${week.availability[employee][day] ? 'checked' : ''}></td>`).join('')}</tr>`).join('');
  }

  function renderSchedule(week) {
    const schedule = getWeekSchedule(week);
    document.getElementById('scheduleBody').innerHTML = VENUES.map(venue => `<tr><td class="venue-cell"><i class="venue-mark ${venue.mark}"></i>${venue.name}</td>${DAYS.map((_, day) => {
      const assigned = schedule.main[venue.key][day];
      const value = valueFor(venue.key, day);
      return `<td>${assigned === null || assigned === undefined ? '<span class="empty-shift">Не закрыто</span>' : `<div class="shift-chip"><span class="employee-chip" title="${safeText(state.employees[assigned])}"><i class="tiny-avatar">${safeText(state.employees[assigned][0] || '?')}</i>${safeText(labelName(state.employees[assigned]))}</span><span class="shift-value">${formatValue(value)}</span></div>`}</td>`;
    }).join('')}</tr>`).join('');
  }

  function renderSupport(week, dates) {
    const support = getWeekSchedule(week).support;
    document.getElementById('supportList').innerHTML = DAYS.map((day, index) => {
      const employee = support[index];
      return `<div class="support-row"><span class="support-day">${day} <span style="color:#a2a69e;font-weight:400">${formatDate(dates[index], { day: 'numeric', month: 'short' })}</span></span>${employee === null || employee === undefined ? '<span class="empty-shift">Не назначен</span>' : `<span class="support-person"><i class="tiny-avatar">${safeText(state.employees[employee][0] || '?')}</i><span class="employee-chip" title="${safeText(state.employees[employee])}">${safeText(labelName(state.employees[employee]))}</span></span>`}<span class="support-state ${employee === null || employee === undefined ? 'open' : ''}">${employee === null || employee === undefined ? 'Нужен ответственный' : 'Дежурный'}</span></div>`;
    }).join('');
  }

  function renderStats(week) {
    const schedule = getWeekSchedule(week);
    const filled = VENUES.reduce((sum, venue) => sum + schedule.main[venue.key].filter(value => value !== null && value !== undefined).length, 0);
    const support = schedule.support.filter(value => value !== null && value !== undefined).length;
    const available = week.availability.reduce((sum, days) => sum + days.filter(Boolean).length, 0);
    const totalValue = VENUES.reduce((sum, venue) => sum + schedule.main[venue.key].reduce((venueSum, employee, day) => venueSum + (employee === null || employee === undefined ? 0 : valueFor(venue.key, day)), 0), 0);
    document.getElementById('filledCount').textContent = filled;
    document.getElementById('totalCount').textContent = '/ 21';
    document.getElementById('unfilledCount').textContent = `${21 - filled} не закрыто`;
    document.getElementById('supportCount').textContent = support;
    document.getElementById('supportUnfilled').textContent = `${7 - support} не назначено`;
    document.getElementById('availabilityStat').textContent = `${Math.round(available / 56 * 100)}%`;
    document.getElementById('availabilityText').textContent = `${available} из 56 отметок`;
    document.getElementById('averageValue').textContent = formatValue(totalValue / 8);
  }

  function valueFor(venue, day) { return venue === 'light' ? 1.25 : venue === 'light2' ? (day === 4 || day === 5 ? 2 : 1.5) : 0.8; }
  function formatValue(value) { return Number(value).toLocaleString('ru-RU', { minimumFractionDigits: Number.isInteger(value) ? 0 : 1, maximumFractionDigits: 2 }); }
  function getMonthlyTotals() {
    const monthStart = new Date(currentStart().getFullYear(), currentStart().getMonth(), 1);
    const nextMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
    const totals = state.employees.map(() => ({ shifts: 0, value: 0, support: 0 }));
    Object.entries(state.history).forEach(([key, rows]) => { const date = new Date(`${key}T12:00:00`); if (date >= monthStart && date < nextMonth) rows.forEach((row, i) => { if (totals[i]) { totals[i].shifts += row.shifts; totals[i].value += row.value; totals[i].support += row.support; } }); });
    Object.entries(state.weeks).forEach(([key, week]) => {
      if (!week.schedule) return;
      const start = new Date(`${key}T12:00:00`);
      const schedule = week.schedule;
      getDates(start).forEach((date, day) => {
        if (date < monthStart || date >= nextMonth) return;
        VENUES.forEach(venue => { const employee = schedule.main[venue.key][day]; if (employee !== null && employee !== undefined && totals[employee]) { totals[employee].shifts++; totals[employee].value += valueFor(venue.key, day); } });
        const employee = schedule.support[day]; if (employee !== null && employee !== undefined && totals[employee]) totals[employee].support++;
      });
    });
    return totals;
  }

  function renderWorkload(week) {
    const schedule = getWeekSchedule(week);
    const entries = state.employees.map((name, employee) => ({ name, employee, shifts: 0, value: 0, support: 0 }));
    if (period === 'week') {
      VENUES.forEach(venue => schedule.main[venue.key].forEach((employee, day) => { if (employee !== null && employee !== undefined) { entries[employee].shifts++; entries[employee].value += valueFor(venue.key, day); } }));
      schedule.support.forEach(employee => { if (employee !== null && employee !== undefined) entries[employee].support++; });
      document.getElementById('workloadFoot').textContent = 'Ценность «Лайт» рассчитана по оценке 1,25 за смену. Саппорт показан отдельно и не влияет на ценность.';
    } else {
      const monthly = getMonthlyTotals();
      entries.forEach(entry => Object.assign(entry, monthly[entry.employee]));
      document.getElementById('workloadFoot').textContent = `Учтены сохранённые графики за ${new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(currentStart())}. Ценность «Лайт» — оценка 1,25.`;
    }
    const maxValue = Math.max(1, ...entries.map(entry => entry.value));
    document.getElementById('workloadBody').innerHTML = entries.map(entry => `<tr><td class="employee-name"><i class="workload-avatar">${safeText(entry.name[0] || '?')}</i>${safeText(entry.name)}</td><td>${entry.shifts}</td><td class="workload-value">${formatValue(entry.value)}</td><td>${entry.support}</td><td><span class="workload-bar"><i style="width:${Math.max(entry.value ? 8 : 0, entry.value / maxValue * 100)}%"></i></span>${entry.value ? formatValue(entry.value) : '—'}</td></tr>`).join('');
  }

  function countOpen(schedule) { return 21 - VENUES.reduce((sum, venue) => sum + schedule.main[venue.key].filter(value => value !== null && value !== undefined).length, 0) + 7 - schedule.support.filter(value => value !== null && value !== undefined).length; }

  function monthlyBase(start, excludeKey) {
    const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
    const nextMonth = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const totals = state.employees.map(() => ({ shifts: 0, value: 0, support: 0 }));
    Object.entries(state.weeks).forEach(([key, week]) => {
      if (!week.schedule || key === excludeKey || new Date(`${key}T12:00:00`) >= start) return;
      getDates(new Date(`${key}T12:00:00`)).forEach((date, day) => {
        if (date < monthStart || date >= nextMonth) return;
        VENUES.forEach(venue => { const employee = week.schedule.main[venue.key][day]; if (employee !== null && employee !== undefined) { totals[employee].shifts++; totals[employee].value += valueFor(venue.key, day); } });
        const supportEmployee = week.schedule.support[day]; if (supportEmployee !== null && supportEmployee !== undefined) totals[supportEmployee].support++;
      });
    });
    return totals;
  }

  function generateSchedule() {
    const start = currentStart();
    const key = weekKey(start);
    const week = getWeek(start);
    const monthly = monthlyBase(start, key);
    const main = VENUES.reduce((result, venue) => (result[venue.key] = Array(7).fill(null), result), {});
    const support = Array(7).fill(null);
    // Rotate venue order across days so the first-listed venue has no systematic advantage.
    for (let day = 0; day < 7; day++) {
      const assignedToday = new Set();
      const venuesToday = VENUES.map((_, index) => VENUES[(index + day) % VENUES.length]);
      for (const venue of venuesToday) {
        const candidates = state.employees.map((_, employee) => employee).filter(employee => week.availability[employee][day] && !assignedToday.has(employee));
        candidates.sort((a, b) => monthly[a].shifts - monthly[b].shifts || monthly[a].value - monthly[b].value || ((a - day - start.getDate() + 80) % 8) - ((b - day - start.getDate() + 80) % 8));
        const selected = candidates[0];
        if (selected !== undefined) {
          main[venue.key][day] = selected;
          assignedToday.add(selected);
          monthly[selected].shifts++;
          monthly[selected].value += valueFor(venue.key, day);
        }
      }
      const candidates = state.employees.map((_, employee) => employee).filter(employee => week.availability[employee][day]);
      candidates.sort((a, b) => monthly[a].support - monthly[b].support || ((a - day - start.getDate() + 80) % 8) - ((b - day - start.getDate() + 80) % 8));
      if (candidates.length) { support[day] = candidates[0]; monthly[candidates[0]].support++; }
    }
    week.schedule = { main, support, approved: false };
    persist(); render();
    const open = countOpen(week.schedule);
    showToast(open ? `График составлен. Осталось закрыть ${open} позиций — нужно решение ответственного.` : 'График составлен с учётом доступности и нагрузки.');
  }

  function openSettings() {
    document.getElementById('employeeInputs').innerHTML = state.employees.map((name, index) => `<div class="employee-input"><label for="employee-${index + 1}">${index + 1}</label><input id="employee-${index + 1}" maxlength="50" value="${safeText(name)}" aria-label="Имя сотрудника ${index + 1}"></div>`).join('');
    document.getElementById('settingsModal').hidden = false;
    document.getElementById('employee-1').focus();
  }
  function closeSettings() { document.getElementById('settingsModal').hidden = true; }
  function saveSettings() {
    const names = Array.from({ length: 8 }, (_, index) => document.getElementById(`employee-${index + 1}`).value.trim());
    if (names.some(name => !name)) { showToast('Заполните имена всех восьми сотрудников.'); return; }
    if (new Set(names.map(name => name.toLocaleLowerCase('ru-RU'))).size !== names.length) { showToast('Имена сотрудников должны различаться.'); return; }
    state.employees = names;
    Object.values(state.weeks).forEach(week => { if (week.schedule) week.schedule.approved = false; });
    persist(); closeSettings(); render(); showToast('Состав команды обновлён.');
  }

  document.getElementById('prevWeek').addEventListener('click', () => { currentDate = shiftDate(currentDate, -7); render(); });
  document.getElementById('nextWeek').addEventListener('click', () => { currentDate = shiftDate(currentDate, 7); render(); });
  document.getElementById('thisWeek').addEventListener('click', () => { currentDate = mondayOf(new Date()); render(); });
  document.getElementById('generateButton').addEventListener('click', generateSchedule);
  document.getElementById('approveButton').addEventListener('click', () => {
    const week = getWeek(currentStart());
    if (!week.schedule) { showToast('Сначала составьте график.'); return; }
    const open = countOpen(week.schedule);
    if (open && !week.schedule.approved) { showToast(`Нельзя подтвердить: ${open} позиций требуют решения ответственного.`); return; }
    week.schedule.approved = !week.schedule.approved; persist(); render();
    showToast(week.schedule.approved ? 'График подтверждён.' : 'Подтверждение снято.');
  });
  document.getElementById('availabilityBody').addEventListener('change', event => {
    if (!event.target.matches('.availability-check')) return;
    const week = getWeek(currentStart());
    week.availability[Number(event.target.dataset.employee)][Number(event.target.dataset.day)] = event.target.checked;
    if (week.schedule) week.schedule.approved = false;
    persist(); render();
  });
  document.getElementById('markAllButton').addEventListener('click', () => {
    const week = getWeek(currentStart());
    week.availability = Object.fromEntries(state.employees.map((_, employee) => [employee, Array(7).fill(true)]));
    if (week.schedule) week.schedule.approved = false;
    persist(); render(); showToast('Отмечена доступность всех сотрудников на все дни.');
  });
  document.getElementById('clearAllButton').addEventListener('click', () => {
    const week = getWeek(currentStart());
    week.availability = Object.fromEntries(state.employees.map((_, employee) => [employee, Array(7).fill(false)]));
    if (week.schedule) week.schedule.approved = false;
    persist(); render(); showToast('Все отметки доступности сняты.');
  });
  document.querySelectorAll('.period-button').forEach(button => button.addEventListener('click', () => {
    period = button.dataset.period;
    document.querySelectorAll('.period-button').forEach(item => item.classList.toggle('active', item === button));
    renderWorkload(getWeek(currentStart()));
  }));
  document.getElementById('settingsButton').addEventListener('click', openSettings);
  document.getElementById('closeSettings').addEventListener('click', closeSettings);
  document.getElementById('cancelSettings').addEventListener('click', closeSettings);
  document.getElementById('saveSettings').addEventListener('click', saveSettings);
  document.getElementById('settingsModal').addEventListener('click', event => { if (event.target.id === 'settingsModal') closeSettings(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeSettings(); });
  persist();
  render();
})();
