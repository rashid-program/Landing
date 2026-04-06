// Admin Edit Mode System
class AdminEditor {
  constructor() {
    this.isLoggedIn = false;
    this.isEditMode = false;
    this.editableElements = [];
    this.init();
  }

  init() {
    this.setupAuthModal();
    this.setupEditButton();
    this.loadEditableElements();
    this.checkAuthStatus();
  }

  setupAuthModal() {
    // Create modal HTML if it doesn't exist
    if (!document.getElementById('auth-modal')) {
      const modalHTML = `
        <div id="auth-modal" class="auth-modal hidden">
          <div class="auth-modal-backdrop"></div>
          <div class="auth-modal-content">
            <div class="auth-modal-header">
              <h2>Вход в админ-панель</h2>
              <button class="auth-modal-close" aria-label="Закрыть">×</button>
            </div>
            <form id="auth-form" class="auth-form">
              <div class="auth-field">
                <label for="admin-password">Пароль администратора</label>
                <input type="password" id="admin-password" placeholder="Введите пароль" required>
              </div>
              <button type="submit" class="auth-submit">Войти</button>
              <div class="auth-error hidden" id="auth-error"></div>
            </form>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    const modal = document.getElementById('auth-modal');
    const closeBtn = modal.querySelector('.auth-modal-close');
    const form = document.getElementById('auth-form');
    const backdrop = modal.querySelector('.auth-modal-backdrop');

    closeBtn.addEventListener('click', () => this.closeAuthModal());
    backdrop.addEventListener('click', () => this.closeAuthModal());
    form.addEventListener('submit', (e) => this.handleAuth(e));
  }

  setupEditButton() {
    const editBtn = document.getElementById('edit-btn');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (this.isLoggedIn) {
          this.toggleEditMode();
        } else {
          this.openAuthModal();
        }
      });
    }
  }

  loadEditableElements() {
    this.editableElements = Array.from(document.querySelectorAll('[data-editable]'));
    // Load saved texts from server
    this.loadTextsFromServer();
  }

  async loadTextsFromServer() {
    try {
      const response = await fetch('/api/texts');
      const texts = await response.json();

      // Apply saved texts to elements (with HTML/styling preserved)
      Object.entries(texts).forEach(([id, html]) => {
        const el = document.querySelector(`[data-editable="${id}"]`);
        if (el) {
          el.innerHTML = html;
        }
      });
    } catch (error) {
      console.error('Failed to load texts:', error);
    }
  }

  openAuthModal() {
    document.getElementById('auth-modal').classList.remove('hidden');
    document.getElementById('admin-password').focus();
  }

  closeAuthModal() {
    document.getElementById('auth-modal').classList.add('hidden');
  }

  async handleAuth(e) {
    e.preventDefault();
    const password = document.getElementById('admin-password').value;
    const errorDiv = document.getElementById('auth-error');

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (response.ok) {
        this.isLoggedIn = true;
        localStorage.setItem('adminLoggedIn', 'true');
        this.closeAuthModal();
        this.updateEditButton();
        errorDiv.classList.add('hidden');
      } else {
        errorDiv.textContent = 'Неверный пароль';
        errorDiv.classList.remove('hidden');
      }
    } catch (error) {
      errorDiv.textContent = 'Ошибка подключения';
      errorDiv.classList.remove('hidden');
    }

    document.getElementById('admin-password').value = '';
  }

  updateEditButton() {
    const btn = document.getElementById('edit-btn');
    if (this.isLoggedIn) {
      btn.classList.remove('btn-edit-inactive');
    } else {
      btn.classList.add('btn-edit-inactive');
    }
  }

  toggleEditMode() {
    this.isEditMode = !this.isEditMode;
    document.body.classList.toggle('edit-mode', this.isEditMode);

    if (this.isEditMode) {
      this.enableEditMode();
    } else {
      this.disableEditMode();
    }
  }

  enableEditMode() {
    this.editableElements.forEach(el => {
      // Skip if already wrapped
      if (el.closest('.editable-wrapper')) return;
      this.makeElementEditable(el);
    });
    document.getElementById('edit-btn').textContent = 'Готово';
    document.getElementById('edit-btn').classList.add('edit-active');
  }

  disableEditMode() {
    // Remove all edit icons and wrappers
    document.querySelectorAll('.edit-icon').forEach(icon => {
      const wrapper = icon.closest('.editable-wrapper');
      if (wrapper) {
        const el = wrapper.querySelector('[data-editable]');
        if (el) {
          wrapper.parentNode.insertBefore(el, wrapper);
          wrapper.remove();
        }
      }
    });
    document.getElementById('edit-btn').textContent = 'Редактировать';
    document.getElementById('edit-btn').classList.remove('edit-active');
  }

  makeElementEditable(el) {
    // Skip if already has edit UI
    if (el.closest('.editable-wrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'editable-wrapper';
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-block';

    const icon = document.createElement('button');
    icon.className = 'edit-icon';
    icon.innerHTML = '✎';
    icon.type = 'button';
    icon.setAttribute('aria-label', 'Редактировать текст');
    icon.addEventListener('click', (e) => {
      e.preventDefault();
      this.startInlineEdit(el);
    });

    el.parentNode.insertBefore(wrapper, el);
    wrapper.appendChild(el);
    wrapper.appendChild(icon);
  }

  removeEditableUI(el) {
    const wrapper = el.closest('.editable-wrapper');
    if (wrapper) {
      const icon = wrapper.querySelector('.edit-icon');
      if (icon) icon.remove();
    }
  }

  startInlineEdit(el) {
    // Prevent multiple edit panels on same element
    if (el.classList.contains('inline-editor-active')) return;

    const currentHTML = el.innerHTML;
    const editableId = el.getAttribute('data-editable');

    // Create inline editor
    const editor = document.createElement('div');
    editor.className = 'inline-editor';

    const inputElement = document.createElement('textarea');
    inputElement.className = 'inline-editor-textarea';
    inputElement.value = currentHTML;

    const saveBtn = document.createElement('button');
    saveBtn.className = 'inline-editor-save';
    saveBtn.textContent = 'Сохранить';
    saveBtn.type = 'button';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'inline-editor-cancel';
    cancelBtn.textContent = 'Отмена';
    cancelBtn.type = 'button';

    editor.appendChild(inputElement);
    editor.appendChild(saveBtn);
    editor.appendChild(cancelBtn);

    const wrapper = el.closest('.editable-wrapper') || el.parentNode;
    el.style.display = 'none';
    el.classList.add('inline-editor-active');
    wrapper.insertBefore(editor, el);
    inputElement.focus();
    inputElement.select();

    saveBtn.addEventListener('click', () => {
      this.saveEdit(el, inputElement.value, editableId, editor, wrapper);
    });

    cancelBtn.addEventListener('click', () => {
      editor.remove();
      el.style.display = '';
      el.classList.remove('inline-editor-active');
    });

    inputElement.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        this.saveEdit(el, inputElement.value, editableId, editor, wrapper);
      } else if (e.key === 'Escape') {
        editor.remove();
        el.style.display = '';
        el.classList.remove('inline-editor-active');
      }
    });
  }

  async saveEdit(el, newText, editableId, editor, wrapper) {
    try {
      // Get all current editable values
      const allEditable = {};
      this.editableElements.forEach(elem => {
        const id = elem.getAttribute('data-editable');
        // Get inner HTML to preserve spans with styles
        allEditable[id] = elem.innerHTML;
      });

      // Update the one we're editing - replace text while preserving HTML structure
      const oldHTML = allEditable[editableId];

      // Create temporary element to safely update text with HTML preservation
      const temp = document.createElement('div');
      temp.innerHTML = oldHTML;

      // Replace text content while preserving spans and styling
      let updated = false;

      function replaceText(node) {
        for (let child of node.childNodes) {
          if (child.nodeType === 3) { // Text node
            child.textContent = newText;
            updated = true;
            return true;
          } else if (child.nodeType === 1) { // Element node (like <span>)
            // Recursively look for text inside
            if (replaceText(child)) {
              return true;
            }
          }
        }
        return false;
      }

      replaceText(temp);

      // If no text found, fallback
      if (!updated) {
        temp.textContent = newText;
      }

      allEditable[editableId] = temp.innerHTML;

      // Save to server
      const response = await fetch('/api/texts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: 'mathx2026',
          texts: allEditable
        })
      });

      if (response.ok) {
        // Update element with new HTML (preserving styles)
        el.innerHTML = temp.innerHTML;
        editor.remove();
        el.style.display = '';
        el.classList.remove('inline-editor-active');
        this.showSaveNotification('Изменения сохранены ✓');
      }
    } catch (error) {
      console.error('Save error:', error);
      this.showSaveNotification('Ошибка сохранения', true);
    }
  }

  showSaveNotification(message, isError = false) {
    const notification = document.createElement('div');
    notification.className = `save-notification ${isError ? 'error' : 'success'}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('show');
    }, 10);

    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }

  checkAuthStatus() {
    if (localStorage.getItem('adminLoggedIn') === 'true') {
      this.isLoggedIn = true;
      this.updateEditButton();
    }
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new AdminEditor();
  });
} else {
  new AdminEditor();
}
