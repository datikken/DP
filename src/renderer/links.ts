import type { Link, LinkCreateInput, LinkUpdateInput } from '../types';
import { validateUrl } from '../validation';

// ---- Element refs ----
const sidebarList = document.getElementById('sidebar-list') as HTMLElement;
const sidebarEmpty = document.getElementById('sidebar-empty') as HTMLDivElement;
const sidebarNoMatch = document.getElementById('sidebar-no-match') as HTMLDivElement;
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const searchClear = document.getElementById('search-clear') as HTMLButtonElement;
const linkCount = document.getElementById('link-count') as HTMLSpanElement;

const greeting = document.getElementById('greeting') as HTMLParagraphElement;
const logoutBtn = document.getElementById('logout-btn') as HTMLButtonElement;
const newBtn = document.getElementById('new-btn') as HTMLButtonElement;
const refreshAllBtn = document.getElementById('refresh-all-btn') as HTMLButtonElement;
const refreshAllIcon = document.getElementById('refresh-all-icon') as HTMLElement;
const messageEl = document.getElementById('message') as HTMLParagraphElement;

const detailEmpty = document.getElementById('detail-empty') as HTMLDivElement;
const detail = document.getElementById('detail') as HTMLDivElement;
const detailName = document.getElementById('detail-name') as HTMLHeadingElement;
const detailUrl = document.getElementById('detail-url') as HTMLParagraphElement;
const openBtn = document.getElementById('open-btn') as HTMLButtonElement;
const detailStatus = document.getElementById('detail-status') as HTMLElement;
const detailCheck = document.getElementById('detail-check') as HTMLElement;
const detailCreated = document.getElementById('detail-created') as HTMLElement;
const detailUpdated = document.getElementById('detail-updated') as HTMLElement;
const editBtn = document.getElementById('edit-btn') as HTMLButtonElement;
const deleteBtn = document.getElementById('delete-btn') as HTMLButtonElement;

const modal = document.getElementById('modal') as HTMLDivElement;
const modalTitle = document.getElementById('modal-title') as HTMLHeadingElement;
const form = document.getElementById('link-form') as HTMLFormElement;
const formError = document.getElementById('form-error') as HTMLParagraphElement;
const cancelBtn = document.getElementById('cancel-btn') as HTMLButtonElement;
const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;

const idInput = document.getElementById('link-id') as HTMLInputElement;
const urlInput = document.getElementById('url') as HTMLInputElement;
const nameInput = document.getElementById('name') as HTMLInputElement;
const httpStatusInput = document.getElementById('http_status') as HTMLInputElement;
const lastCheckInput = document.getElementById('last_check') as HTMLInputElement;
const metaFields = document.getElementById('meta-fields') as HTMLDivElement;

// ---- State ----
let currentLinks: Link[] = [];
let selectedId: number | null = null;
let liveUrlError = false;
// Links whose HTTP check is currently in flight.
const checkingIds = new Set<number>();
// Current search text; the sidebar shows only links whose name or URL matches.
let searchQuery = '';

// ---- Helpers ----

/**
 * Returns the links that match the current search query by name or URL
 * (case-insensitive substring). With an empty query, all links are returned.
 */
function visibleLinks(): Link[] {
  const q = searchQuery.trim().toLowerCase();
  if (q === '') return currentLinks;
  return currentLinks.filter((l) => {
    const name = (l.name ?? '').toLowerCase();
    const url = l.url.toLowerCase();
    return name.includes(q) || url.includes(q);
  });
}

function setMessage(text: string, type: 'error' | 'success' | '' = ''): void {
  messageEl.textContent = text;
  messageEl.className =
    'mb-4 min-h-[20px] text-sm ' +
    (type === 'error'
      ? 'text-red-400'
      : type === 'success'
      ? 'text-green-400'
      : 'text-slate-400');
}

function fmt(value: string | null): string {
  return value ? value : '';
}

/** Stored "YYYY-MM-DD HH:MM[:SS]" -> "YYYY-MM-DDTHH:MM" for datetime-local. */
function toDatetimeLocal(value: string | null): string {
  if (!value) return '';
  const s = value.trim().replace(' ', 'T');
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}` : '';
}

/** datetime-local "YYYY-MM-DDTHH:MM" -> stored "YYYY-MM-DD HH:MM" (or null). */
function fromDatetimeLocal(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}` : null;
}

function statusColorClasses(status: number | null): string {
  if (status === null) return 'bg-base-600 ring-base-600';
  if (status === 0) return 'bg-red-500 ring-red-500/40'; // request failed
  if (status >= 200 && status < 300) return 'bg-green-500 ring-green-500/40';
  if (status >= 300 && status < 400) return 'bg-yellow-400 ring-yellow-400/40';
  if (status >= 400) return 'bg-red-500 ring-red-500/40';
  return 'bg-base-600 ring-base-600';
}

function statusBadge(status: number | null): HTMLSpanElement {
  const span = document.createElement('span');
  let cls = 'inline-block rounded-full px-2 py-0.5 text-xs font-semibold ';
  if (status === null) {
    cls += 'bg-base-600 text-slate-300';
  } else if (status >= 200 && status < 300) {
    cls += 'bg-green-500/20 text-green-400';
  } else if (status >= 300 && status < 400) {
    cls += 'bg-yellow-500/20 text-yellow-400';
  } else if (status >= 400) {
    cls += 'bg-red-500/20 text-red-400';
  } else {
    cls += 'bg-base-600 text-slate-300';
  }
  span.className = cls;
  span.textContent = status === null ? 'n/a' : String(status);
  return span;
}

/**
 * Builds the clickable status "circle" for a link. Clicking it (re)runs the
 * HTTP check for that link. Shows a spinner while a check is in flight.
 */
function makeStatusCircle(link: Link): HTMLButtonElement {
  const isChecking = checkingIds.has(link.id);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.title = isChecking
    ? 'Checking\u2026'
    : `Check status (currently ${link.http_status ?? 'unknown'})`;
  btn.setAttribute('aria-label', 'Check link status');
  const base =
    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-2 transition hover:scale-110 focus:outline-none';
  btn.className = isChecking
    ? `${base} bg-transparent ring-brand/50 cursor-wait`
    : `${base} ${statusColorClasses(link.http_status)} cursor-pointer`;

  if (isChecking) {
    const spinner = document.createElement('span');
    spinner.className =
      'h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand border-t-transparent';
    btn.appendChild(spinner);
  } else if (link.http_status !== null) {
    const label = document.createElement('span');
    label.className = 'text-[9px] font-bold text-white/90';
    label.textContent = String(link.http_status);
    btn.appendChild(label);
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation(); // don't trigger sidebar item selection
    void checkLink(link.id);
  });
  return btn;
}

// ---- Sidebar + detail rendering ----

function renderSidebar(): void {
  sidebarList.innerHTML = '';
  linkCount.textContent = String(currentLinks.length);

  // Empty database: show the "No links yet" hint and hide search-only hints.
  if (currentLinks.length === 0) {
    sidebarEmpty.classList.remove('hidden');
    sidebarNoMatch.classList.add('hidden');
    return;
  }
  sidebarEmpty.classList.add('hidden');

  // Search active but nothing matched: show the "no match" hint.
  const matches = visibleLinks();
  if (matches.length === 0) {
    sidebarNoMatch.classList.remove('hidden');
    return;
  }
  sidebarNoMatch.classList.add('hidden');

  const pinned = matches.filter((l) => l.pinned === 1);
  const unpinned = matches.filter((l) => l.pinned !== 1);

  // Pinned links live in their own group above the rest and can only be
  // reordered among themselves; the same goes for the unpinned group.
  if (pinned.length > 0) {
    sidebarList.appendChild(makeGroupHeader('Pinned', pinned.length));
    const group = makeGroup('pinned');
    for (const link of pinned) group.appendChild(makeSidebarItem(link));
    sidebarList.appendChild(group);
  }

  if (unpinned.length > 0) {
    if (pinned.length > 0) {
      sidebarList.appendChild(makeGroupHeader('All links', unpinned.length));
    }
    const group = makeGroup('unpinned');
    for (const link of unpinned) group.appendChild(makeSidebarItem(link));
    sidebarList.appendChild(group);
  }
}

/** <ul> that groups the rows of one drag scope. */
function makeGroup(kind: 'pinned' | 'unpinned'): HTMLUListElement {
  const group = document.createElement('ul');
  group.dataset.group = kind;
  group.className = kind === 'pinned' ? 'mb-2 list-none' : 'list-none';
  return group;
}

/** Small label shown above a group of links. */
function makeGroupHeader(label: string, count: number): HTMLDivElement {
  const header = document.createElement('div');
  header.className =
    'mb-1 mt-2 flex items-center gap-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500';
  const text = document.createElement('span');
  text.textContent = label;
  const badge = document.createElement('span');
  badge.className = 'rounded bg-base-700 px-1.5 py-0.5 text-[10px] text-slate-400';
  badge.textContent = String(count);
  header.append(text, badge);
  return header;
}

function makeSidebarItem(link: Link): HTMLLIElement {
  const item = document.createElement('li');
  item.dataset.id = String(link.id);
  item.draggable = true;
  item.className =
    'group mb-1 flex cursor-grab select-none items-center gap-3 rounded-lg px-3 py-2 text-left transition active:cursor-grabbing ' +
    (link.id === selectedId
      ? 'bg-brand/20 ring-1 ring-brand'
      : 'hover:bg-base-700');

  const dot = makeStatusCircle(link);
  dot.draggable = false;
  dot.classList.add('shrink-0');

  const textWrap = document.createElement('div');
  textWrap.className = 'pointer-events-none min-w-0 flex-1';

  const title = document.createElement('div');
  title.className =
    'truncate text-sm font-semibold ' +
    (link.id === selectedId ? 'text-white' : 'text-slate-200');

    title.textContent = link.name ? link.name : link.url;

  const sub = document.createElement('div');
  sub.className = 'truncate text-xs text-slate-500';
  sub.textContent = link.name ? link.url : 'unnamed';





  textWrap.append(title, sub);
  item.append(dot, textWrap, makePinButton(link));

  item.addEventListener('click', () => selectLink(link.id));
  wireDragEvents(item, link);
  return item;
}

/** Toggle button that pins or unpins a link. */
function makePinButton(link: Link): HTMLButtonElement {
  const isPinned = link.pinned === 1;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.title = isPinned ? 'Unpin' : 'Pin to top';
  btn.setAttribute('aria-label', btn.title);
  btn.setAttribute('aria-pressed', String(isPinned));
  btn.className =
    'shrink-0 cursor-pointer rounded p-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ' +
    (isPinned
      ? 'text-brand-light hover:bg-base-600'
      : 'text-slate-500 opacity-0 hover:bg-base-600 hover:text-slate-300 group-hover:opacity-100 focus-visible:opacity-100');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute(
    'd',
    'M14.5 2.5a1 1 0 0 0-1.4 0l-2 2a1 1 0 0 0 0 1.4l.3.3-3.3 2.2a1 1 0 0 0-.3.3L5 10.5a1 1 0 0 0 .4 1.7l3 1-4 4a1 1 0 1 0 1.4 1.4l4-4 1 3a1 1 0 0 0 1.7.4l1.8-1.8a1 1 0 0 0 .3-.3l2.2-3.3.3.3a1 1 0 0 0 1.4 0l2-2a1 1 0 0 0 0-1.4z'
  );
  svg.appendChild(path);
  btn.appendChild(svg);

  btn.addEventListener('click', (e) => {
    e.stopPropagation(); // don't select the item
    void togglePin(link);
  });
  return btn;
}

// ---- Drag and drop ----

/** Id of the row being dragged, or null when no drag is in progress. */
let draggedId: number | null = null;

/**
 * Wires the drag lifecycle for one sidebar row.
 *
 * Reordering is confined to a row's own group: a pinned link can move among
 * pinned links only, an unpinned one among unpinned ones. Dropping a pinned
 * link outside the pinned group is ignored rather than silently unpinning it -
 * pinning stays an explicit action via the pin button.
 */
function wireDragEvents(item: HTMLLIElement, link: Link): void {
  item.addEventListener('dragstart', (e) => {
    draggedId = link.id;
    item.classList.add('opacity-40');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(link.id)); // required by Firefox
    }
  });

  item.addEventListener('dragend', () => {
    draggedId = null;
    item.classList.remove('opacity-40');
    clearDropMarkers();
  });

  item.addEventListener('dragover', (e) => {
    const dragged = draggedLink();
    if (!dragged || dragged.id === link.id) return;
    if (dragged.pinned !== link.pinned) {
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'none';
      return; // different group: not a valid target
    }

    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

    // The upper half of a row inserts before it, the lower half after.
    const rect = item.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    clearDropMarkers();
    item.classList.add(after ? 'drop-after' : 'drop-before');
  });

  item.addEventListener('dragleave', () => {
    item.classList.remove('drop-before', 'drop-after');
  });

  item.addEventListener('drop', (e) => {
    const dragged = draggedLink();
    if (!dragged || dragged.id === link.id || dragged.pinned !== link.pinned) return;

    e.preventDefault();
    const rect = item.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    clearDropMarkers();
    void persistOrder(buildOrderAfterMove(dragged.id, link.id, after));
  });
}

function draggedLink(): Link | null {
  if (draggedId === null) return null;
  return currentLinks.find((l) => l.id === draggedId) ?? null;
}

function clearDropMarkers(): void {
  sidebarList
    .querySelectorAll('.drop-before, .drop-after')
    .forEach((el) => el.classList.remove('drop-before', 'drop-after'));
}

/**
 * Computes the full id list after moving `movingId` next to `targetId`.
 * The result is always "all pinned ids, then all unpinned ids", each part
 * internally reordered, so group membership can never change by dragging.
 */
function buildOrderAfterMove(movingId: number, targetId: number, after: boolean): number[] {
  const pinned = currentLinks.filter((l) => l.pinned === 1).map((l) => l.id);
  const unpinned = currentLinks.filter((l) => l.pinned !== 1).map((l) => l.id);

  const moving = currentLinks.find((l) => l.id === movingId);
  if (!moving) return [...pinned, ...unpinned];

  const group = moving.pinned === 1 ? pinned : unpinned;
  group.splice(group.indexOf(movingId), 1);

  let insertAt = group.indexOf(targetId);
  if (insertAt === -1) {
    insertAt = group.length; // target is not in this group: append
  } else if (after) {
    insertAt += 1;
  }

  group.splice(insertAt, 0, movingId);
  return [...pinned, ...unpinned];
}

/** Sends a new order to the main process and re-renders from its reply. */
async function persistOrder(orderedIds: number[]): Promise<void> {
  const pinnedCount = currentLinks.filter((l) => l.pinned === 1).length;

  // Optimistically reorder the cache so the row does not snap back, then treat
  // the server's response as the source of truth.
  const byId = new Map(currentLinks.map((l) => [l.id, l]));
  const optimistic = orderedIds
    .map((id) => byId.get(id))
    .filter((l): l is Link => l !== undefined);
  if (optimistic.length === currentLinks.length) {
    currentLinks = optimistic;
    render();
  }

  try {
    const res = await window.links.reorder(orderedIds, pinnedCount);
    if (res.ok) {
      currentLinks = res.links;
      render();
    } else {
      setMessage(res.error || 'Could not save the new order.', 'error');
      await loadLinks(); // roll back to what the database actually holds
    }
  } catch (err) {
    setMessage('Could not save the new order.', 'error');
    console.error(err);
    await loadLinks();
  }
}

/** Pins or unpins a link, then reloads the grouped list. */
async function togglePin(link: Link): Promise<void> {
  const nextPinned = link.pinned !== 1;
  try {
    const res = await window.links.pin(link.id, nextPinned);
    setMessage(
      res.ok
        ? nextPinned
          ? 'Link pinned.'
          : 'Link unpinned.'
        : res.error || 'Could not change the pinned state.',
      res.ok ? 'success' : 'error'
    );
  } catch (err) {
    setMessage('Could not change the pinned state.', 'error');
    console.error(err);
  }
  await loadLinks();
}

function renderDetail(): void {
  const link = currentLinks.find((l) => l.id === selectedId);
  if (!link) {
    detailEmpty.classList.remove('hidden');
    detail.classList.add('hidden');
    return;
  }

    detailEmpty.classList.add('hidden');
  detail.classList.remove('hidden');

  // Hide the heading entirely when the link has no name.
  if (link.name) {
    detailName.textContent = link.name;
    detailName.classList.remove('hidden');
  } else {
    detailName.textContent = '';
    detailName.classList.add('hidden');
  }

  detailUrl.textContent = link.url;

  detailStatus.innerHTML = '';
  const statusRow = document.createElement('div');
  statusRow.className = 'flex items-center gap-2';
  statusRow.appendChild(makeStatusCircle(link));
  // Status text: "n/a" when never checked, "Request failed" for status 0.
  if (link.http_status === 0) {
    const failed = document.createElement('span');
    failed.className = 'text-sm text-red-400';
    failed.textContent = 'Request failed';
    statusRow.appendChild(failed);
  } else if (link.http_status !== null) {
    statusRow.appendChild(statusBadge(link.http_status));
  } else {
    statusRow.appendChild(statusBadge(null));
  }
  detailStatus.appendChild(statusRow);

  detailCheck.textContent = fmt(link.last_check);
  detailCreated.textContent = fmt(link.created_at);
  detailUpdated.textContent = fmt(link.updated_at);
}

function render(): void {
  renderSidebar();
  renderDetail();
}

async function loadLinks(): Promise<void> {
  const res = await window.links.list();
  if (res.ok) {
    currentLinks = res.links;
    // Keep a valid selection, or auto-select the first link.
    if (!currentLinks.some((l) => l.id === selectedId)) {
      selectedId = currentLinks.length > 0 ? currentLinks[0].id : null;
    }
    render();
  } else {
    setMessage(res.error || 'Failed to load links.', 'error');
  }
}

function selectLink(id: number): void {
  selectedId = id;
  render();
}

// ---- Modal ----
function openCreate(): void {
  modalTitle.textContent = 'New Link';
  idInput.value = '';
  httpStatusInput.value = '';
  lastCheckInput.value = '';
  formError.textContent = '';
  urlInput.classList.remove('border-red-500', 'focus:border-red-500');
  liveUrlError = false;
  metaFields.classList.add('hidden');
  metaFields.classList.remove('grid');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  urlInput.focus();
}

function openEdit(link: Link): void {
  modalTitle.textContent = 'Edit Link';
  idInput.value = String(link.id);
  urlInput.value = link.url;
  nameInput.value = link.name ?? '';
  httpStatusInput.value = link.http_status === null ? '' : String(link.http_status);
  lastCheckInput.value = toDatetimeLocal(link.last_check);
  formError.textContent = '';
  urlInput.classList.remove('border-red-500', 'focus:border-red-500');
  liveUrlError = false;
  metaFields.classList.remove('hidden');
  metaFields.classList.add('grid');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  urlInput.focus();
}

function closeModal(): void {
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

// ---- Actions ----

async function handleDelete(link: Link): Promise<void> {
  const label = link.name ? `link "${link.name}"` : `link "${link.url}"`;
  const confirmed = window.confirm(`Delete ${label}? This cannot be undone.`);
  if (!confirmed) return;

  const res = await window.links.remove(link.id);
  if (res.ok) {
    if (selectedId === link.id) selectedId = null;
    setMessage('Link deleted.', 'success');
    await loadLinks();
  } else {
    setMessage(res.error || 'Failed to delete.', 'error');
  }
}

async function checkLink(id: number): Promise<void> {
  if (checkingIds.has(id)) return; // already in flight

  const link = currentLinks.find((l) => l.id === id);
  if (!link) return;

  checkingIds.add(id);
  render();

  try {
    const res = await window.links.check(id);
    if (res.ok) {
      // Update the cached link in place.
      const idx = currentLinks.findIndex((l) => l.id === id);
      if (idx !== -1) currentLinks[idx] = res.link;

      const code = res.link.http_status;
      if (code !== null && code >= 200 && code < 400) {
        setMessage(`Checked: HTTP ${code}`, 'success');
      } else if (code !== null) {
        setMessage(`Checked: HTTP ${code}`, 'error');
      }
    } else {
      // A failed request still records last_check; reflect that by reloading.
      setMessage(res.error || 'Check failed.', 'error');
      const refreshed = await window.links.list();
      if (refreshed.ok) currentLinks = refreshed.links;
    }
  } catch (err) {
    setMessage('Check failed. Please try again.', 'error');
    console.error(err);
  } finally {
    checkingIds.delete(id);
    render();
  }
}

/** True while a "re-check all links" run is in progress. */
let refreshingAll = false;

/** How many links are checked at the same time within one batch. */
const REFRESH_BATCH_SIZE = 100;

/**
 * Re-checks every link in the sidebar in batches of REFRESH_BATCH_SIZE links
 * checked concurrently. Each batch is awaited in full before the next one
 * starts, so at most 100 requests are in flight at once. The button is disabled
 * and spun for the duration so the run cannot be doubled up.
 */
async function refreshAllLinks(): Promise<void> {
  if (refreshingAll || currentLinks.length === 0) return;

  refreshingAll = true;
  refreshAllBtn.disabled = true;
  refreshAllIcon.classList.add('animate-spin');

  const total = currentLinks.length;
  const ids = currentLinks.map((l) => l.id);
  let checked = 0;

  /** Checks a single link and merges the result into the cache. */
  const checkOne = async (id: number): Promise<void> => {
    // The link may have been deleted while the run was going.
    if (!currentLinks.some((l) => l.id === id)) return;

    checkingIds.add(id);
    render();
    try {
      const res = await window.links.check(id);
      if (res.ok) {
        const idx = currentLinks.findIndex((l) => l.id === id);
        if (idx !== -1) currentLinks[idx] = res.link;
      }
    } catch (err) {
      console.error(`Check failed for link ${id}:`, err);
    } finally {
      checkingIds.delete(id);
      checked += 1;
      render();
    }
  };

  try {
    // Work through the links a batch at a time: the first 100 run in parallel,
    // then (after all of them settle) the next 100, and so on.
    for (let start = 0; start < ids.length; start += REFRESH_BATCH_SIZE) {
      const batch = ids.slice(start, start + REFRESH_BATCH_SIZE);
      const end = Math.min(start + REFRESH_BATCH_SIZE, total);
      setMessage(`Checking ${start + 1}–${end} of ${total}…`);

      await Promise.all(batch.map((id) => checkOne(id)));
    }

    // Trust the database for the final state (ordering and last_check alike).
    const refreshed = await window.links.list();
    if (refreshed.ok) {
      currentLinks = refreshed.links;
      render();
    }
    setMessage(`Re-checked ${checked} link${checked === 1 ? '' : 's'}.`, 'success');
  } finally {
    refreshingAll = false;
    refreshAllBtn.disabled = false;
    refreshAllIcon.classList.remove('animate-spin');
  }
}

async function handleSubmit(e: Event): Promise<void> {
  e.preventDefault();
  formError.textContent = '';

  // Client-side validation for instant feedback; the main process re-validates.
  const urlCheck = validateUrl(urlInput.value);
  if (!urlCheck.ok) {
    formError.textContent = urlCheck.error;
    urlInput.focus();
    return;
  }
    const url = urlCheck.url;

  const nameValue = nameInput.value.trim() === '' ? null : nameInput.value.trim();

  saveBtn.disabled = true;
  try {
    const editingId = idInput.value ? Number(idInput.value) : null;
    let res;
    if (editingId) {
            const input: LinkUpdateInput = {
        url,
        name: nameValue,
        http_status: (() => {
          const raw = httpStatusInput.value.trim();
          if (raw === '') return null;
          const n = Number(raw);
          return Number.isFinite(n) ? n : null;
        })(),
        last_check: fromDatetimeLocal(lastCheckInput.value),
      };
      res = await window.links.update(editingId, input);
    } else {
      const createInput: LinkCreateInput = { url, name: nameValue };
      res = await window.links.create(createInput);
    }

    if (res.ok) {
      selectedId = res.link.id;
      closeModal();
      setMessage(editingId ? 'Link updated.' : 'Link created.', 'success');
      await loadLinks();
    } else {
      formError.textContent = res.error || 'Something went wrong.';
    }
  } catch (err) {
    formError.textContent = 'Something went wrong. Please try again.';
    console.error(err);
  } finally {
    saveBtn.disabled = false;
  }
}

// ---- Open in browser ----

/** Opens the currently selected link in the system's default browser. */
async function openSelectedInBrowser(): Promise<void> {
  const link = currentLinks.find((l) => l.id === selectedId);
  if (!link) return;
  const res = await window.links.openExternal(link.url);
  if (!res.ok) setMessage(res.error, 'error');
}

openBtn.addEventListener('click', () => void openSelectedInBrowser());

// ---- Wiring ----

newBtn.addEventListener('click', openCreate);
refreshAllBtn.addEventListener('click', () => void refreshAllLinks());

// ---- Search ----

/** Shows/hides the clear button based on whether a query is present. */
function syncSearchClear(): void {
  if (searchQuery.trim() === '') {
    searchClear.classList.add('hidden');
  } else {
    searchClear.classList.remove('hidden');
  }
}

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value;
  syncSearchClear();
  renderSidebar();
});

searchClear.addEventListener('click', () => {
  searchQuery = '';
  searchInput.value = '';
  syncSearchClear();
  renderSidebar();
  searchInput.focus();
});

// Escape clears the search box while it is focused.
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    searchQuery = '';
    searchInput.value = '';
    syncSearchClear();
    renderSidebar();
  }
});

cancelBtn.addEventListener('click', closeModal);
form.addEventListener('submit', handleSubmit);

// Live URL validation feedback while typing.
const URL_INVALID_CLASSES = ['border-red-500', 'focus:border-red-500'];
urlInput.addEventListener('input', () => {
  if (urlInput.value.trim() === '') {
    urlInput.classList.remove(...URL_INVALID_CLASSES);
    if (liveUrlError) {
      formError.textContent = '';
      liveUrlError = false;
    }
    return;
  }
  const check = validateUrl(urlInput.value);
  if (check.ok) {
    urlInput.classList.remove(...URL_INVALID_CLASSES);
    if (liveUrlError) {
      formError.textContent = '';
      liveUrlError = false;
    }
  } else {
    urlInput.classList.add(...URL_INVALID_CLASSES);
    formError.textContent = check.error;
    liveUrlError = true;
  }
});

editBtn.addEventListener('click', () => {
  const link = currentLinks.find((l) => l.id === selectedId);
  if (link) openEdit(link);
});

deleteBtn.addEventListener('click', () => {
  const link = currentLinks.find((l) => l.id === selectedId);
  if (link) void handleDelete(link);
});

logoutBtn.addEventListener('click', async () => {
  await window.auth.logout();
  window.location.href = 'index.html';
});

modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});

// ---- Boot ----

async function boot(): Promise<void> {
  // Recover the session from the main process (survives window hide/reopen in
  // the tray). Returns username + id, or null when signed out.
  const session = await window.auth.session();
  if (session === null) {
    window.location.href = 'index.html';
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const username = params.get('user') ?? session.username;
  greeting.textContent = username ? `Welcome, ${username}!` : 'Welcome back!';

  await loadLinks();
}

// Logging out from the tray menu ends the session in the main process; follow it.
window.auth.onLoggedOut(() => {
  window.location.href = 'index.html';
});

void boot();
