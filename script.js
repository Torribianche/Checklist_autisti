'use strict';

const checklistItems = [
  { id: 'pneumatici', label: 'Pressione pneumatici' },
  { id: 'luci', label: 'Luci' },
  { id: 'olio', label: 'Livelli olio' },
  { id: 'batteria', label: 'Batteria' },
  { id: 'spie', label: 'Spie accese' },
  { id: 'dotazioni', label: 'Dotazioni di bordo' },
  { id: 'semirimorchio', label: 'Stato semirimorchio' }
];

const form = document.querySelector('#inspection-form');
const driverNameInput = document.querySelector('#driver-name');
const plateInput = document.querySelector('#vehicle-plate');
const notesInput = document.querySelector('#notes');
const photosInput = document.querySelector('#photos');
const formError = document.querySelector('#form-error');
const summary = document.querySelector('#summary');

function formatLocalDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatLocalTime(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function updateClock(date = new Date()) {
  document.querySelector('#inspection-date').value = formatLocalDate(date);
  document.querySelector('#inspection-time').value = formatLocalTime(date);
}

function normalizedPlate(value) {
  return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function setFieldError(input, errorElement, message) {
  input.setCustomValidity(message);
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
  errorElement.textContent = message;
}

function validateForm() {
  let firstInvalid = null;
  const driverError = document.querySelector('#driver-name-error');
  const plateError = document.querySelector('#vehicle-plate-error');
  const notesError = document.querySelector('#notes-error');
  const checklistError = document.querySelector('#checklist-error');

  const driverParts = driverNameInput.value.trim().split(/\s+/).filter(Boolean);
  setFieldError(driverNameInput, driverError, driverParts.length >= 2 ? '' : 'Inserisci nome e cognome dell’autista.');
  const plateValid = normalizedPlate(plateInput.value).length > 0;
  setFieldError(plateInput, plateError, plateValid ? '' : 'Inserisci una targa con almeno una lettera o un numero.');

  let checklistComplete = true;
  checklistItems.forEach((item) => {
    const fieldset = form.querySelector(`[data-check="${item.id}"]`);
    const selected = fieldset.querySelector('input:checked');
    fieldset.classList.toggle('has-error', !selected);
    fieldset.setAttribute('aria-invalid', String(!selected));
    if (!selected) {
      checklistComplete = false;
      if (!firstInvalid) firstInvalid = fieldset.querySelector('input');
    }
  });
  checklistError.textContent = checklistComplete ? '' : 'Valuta tutte le voci della checklist.';

  const hasKo = checklistItems.some((item) => form.querySelector(`[name="check-${item.id}"]:checked`)?.value === 'KO');
  const notesValid = !hasKo || notesInput.value.trim().length > 0;
  setFieldError(notesInput, notesError, notesValid ? '' : 'Descrivi le segnalazioni riscontrate in caso di esito KO.');
  if (!driverNameInput.value.trim() && !firstInvalid) firstInvalid = driverNameInput;
  if (!plateValid && !firstInvalid) firstInvalid = plateInput;
  if (!notesValid && !firstInvalid) firstInvalid = notesInput;

  if (firstInvalid) {
    formError.textContent = 'Completa i campi obbligatori evidenziati prima di terminare il controllo.';
    firstInvalid.focus();
    return false;
  }
  formError.textContent = '';
  return true;
}

function getChecklistResults() {
  return checklistItems.map((item) => ({
    id: item.id,
    voce: item.label,
    esito: form.querySelector(`[name="check-${item.id}"]:checked`).value
  }));
}

function appendDetail(container, label, value) {
  const detail = document.createElement('div');
  detail.className = 'detail-item';
  const title = document.createElement('span');
  title.textContent = label;
  const content = document.createElement('strong');
  content.textContent = value;
  detail.append(title, content);
  container.append(detail);
}

function renderPhotos(files, container, heading = '') {
  container.querySelectorAll('img').forEach((image) => URL.revokeObjectURL(image.src));
  container.replaceChildren();
  if (heading) {
    const title = document.createElement('strong');
    title.textContent = heading;
    container.append(title);
  }
  const previews = document.createElement('div');
  previews.className = 'photo-preview';
  Array.from(files).forEach((file) => {
    const url = URL.createObjectURL(file);
    const thumb = document.createElement('div');
    thumb.className = 'photo-thumb';
    const image = document.createElement('img');
    image.src = url;
    image.alt = `Anteprima: ${file.name}`;
    thumb.append(image);
    previews.append(thumb);
  });
  if (files.length > 0) {
    const count = document.createElement('span');
    count.className = 'photo-count';
    count.textContent = `${files.length} ${files.length === 1 ? 'foto selezionata' : 'foto selezionate'}`;
    previews.append(count);
  }
  container.append(previews);
}

function downloadReport(report) {
  const blob = new Blob([`${JSON.stringify(report, null, 2)}\n`], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.querySelector('#download-link');
  link.href = url;
  link.download = `controllo-${report.identificativo}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function completeInspection() {
  const checkedAt = new Date();
  updateClock(checkedAt);
  const results = getChecklistResults();
  const hasKo = results.some((item) => item.esito === 'KO');
  const normalized = normalizedPlate(plateInput.value);
  const identifier = `${formatLocalDate(checkedAt).replace(/-/g, '')}-${formatLocalTime(checkedAt).replace(':', '')}-${normalized}`;
  const photos = Array.from(photosInput.files).map((file) => ({
    nome_file: file.name,
    tipo: file.type,
    dimensione_byte: file.size
  }));
  const report = {
    identificativo: identifier,
    data: formatLocalDate(checkedAt),
    ora: formatLocalTime(checkedAt),
    autista: driverNameInput.value.trim(),
    targa: plateInput.value.trim().toUpperCase(),
    esito_generale: hasKo ? 'KO' : 'OK',
    controlli: results,
    segnalazioni: notesInput.value.trim(),
    fotografie: photos
  };

  const banner = document.querySelector('#summary-banner');
  banner.dataset.result = hasKo ? 'ko' : 'ok';
  document.querySelector('#summary-status').textContent = hasKo ? 'SEGNALAZIONI PRESENTI' : 'TUTTI I CONTROLLI OK';
  document.querySelector('#summary-id').textContent = identifier;

  const details = document.querySelector('#summary-details');
  details.replaceChildren();
  appendDetail(details, 'Autista', report.autista);
  appendDetail(details, 'Targa veicolo', report.targa);
  appendDetail(details, 'Data e ora', `${report.data} · ${report.ora}`);

  const checks = document.querySelector('#summary-checks');
  checks.replaceChildren();
  results.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'summary-check';
    row.dataset.result = item.esito;
    const label = document.createElement('span');
    label.textContent = item.voce;
    const result = document.createElement('span');
    result.className = 'result-pill';
    result.textContent = item.esito;
    row.append(label, result);
    checks.append(row);
  });

  const notes = document.querySelector('#summary-notes');
  notes.hidden = !report.segnalazioni;
  notes.replaceChildren();
  if (report.segnalazioni) {
    const label = document.createElement('strong');
    label.textContent = 'Segnalazioni';
    const text = document.createElement('p');
    text.textContent = report.segnalazioni;
    notes.append(label, text);
  }

  const photoSummary = document.querySelector('#summary-photos');
  photoSummary.hidden = photos.length === 0;
  if (photos.length) renderPhotos(photosInput.files, photoSummary, 'Fotografie');
  summary.hidden = false;
  summary.scrollIntoView({ behavior: 'smooth', block: 'start' });
  downloadReport(report);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!validateForm()) return;

  const button = form.querySelector('.submit-button');
  button.disabled = true;
  button.querySelector('span').textContent = 'Salvataggio controllo…';
  try {
    completeInspection();
  } catch {
    formError.textContent = 'Si è verificato un problema durante il salvataggio del controllo. Riprova.';
    formError.focus();
  } finally {
    button.disabled = false;
    button.querySelector('span').textContent = 'Controllo terminato';
  }
});

form.addEventListener('input', (event) => {
  if (event.target === driverNameInput && driverNameInput.value.trim().split(/\s+/).filter(Boolean).length >= 2) {
    setFieldError(driverNameInput, document.querySelector('#driver-name-error'), '');
  }
  if (event.target === plateInput && normalizedPlate(plateInput.value)) {
    setFieldError(plateInput, document.querySelector('#vehicle-plate-error'), '');
  }
  if (event.target === notesInput && notesInput.value.trim()) {
    setFieldError(notesInput, document.querySelector('#notes-error'), '');
  }
  if (event.target.matches('input[type="radio"]')) {
    const fieldset = event.target.closest('fieldset');
    fieldset.classList.remove('has-error');
    fieldset.setAttribute('aria-invalid', 'false');
    document.querySelector('#checklist-error').textContent = '';
  }
});

photosInput.addEventListener('change', () => {
  renderPhotos(photosInput.files, document.querySelector('#photo-preview'));
});

document.querySelector('#theme-toggle').addEventListener('click', (event) => {
  const button = event.currentTarget;
  const enabled = document.body.dataset.theme !== 'dark';
  document.body.dataset.theme = enabled ? 'dark' : 'light';
  button.setAttribute('aria-pressed', String(enabled));
  button.querySelector('.theme-label').textContent = enabled ? 'Tema chiaro' : 'Tema scuro';
});

updateClock();
window.setInterval(() => updateClock(), 30000);
