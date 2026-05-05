'use strict';

/**
 * @param {{ Toast: object, Utils: object, Modal: object, POS: object, Session: object }} deps
 */
export function createCategoriesModule(deps) {
  return {
    Categories: {
      allCategories: [],
      editingId: null,

      async init() {
        const addBtn = document.getElementById('add-category-btn');
        if (addBtn) addBtn.addEventListener('click', () => this.openCategoryModal());

        const form = document.getElementById('category-form');
        if (form) form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.saveCategory();
        });

        const closeBtn = document.querySelector('#category-modal .modal-close');
        if (closeBtn) closeBtn.addEventListener('click', () => deps.Modal.close('category-modal'));
        const cancelBtn = document.querySelector('#category-modal .modal-cancel');
        if (cancelBtn) cancelBtn.addEventListener('click', () => deps.Modal.close('category-modal'));
      },

      async load() {
        try {
          const result = await window.electronAPI.findAllCategories(deps.Session.getToken());
          const categories = Array.isArray(result) ? result : (result?.data || []);
          if (categories.length === 0 && result?.error) {
            deps.Toast.error(result.error);
            return;
          }
          this.allCategories = categories;
          this.renderTable();
        } catch (error) {
          console.error('Load categories error:', error);
          deps.Toast.error('Erro ao carregar categorias');
        }
      },

      renderTable() {
        const tbody = document.querySelector('#categories-table tbody');
        if (!tbody) return;

        tbody.textContent = '';

        if (this.allCategories.length === 0) {
          const tr = document.createElement('tr');
          const td = document.createElement('td');
          td.textContent = 'Nenhuma categoria encontrada';
          td.colSpan = 3;
          td.style.textAlign = 'center';
          tr.appendChild(td);
          tbody.appendChild(tr);
          return;
        }

        for (const cat of this.allCategories) {
          const tr = document.createElement('tr');

          const nameTd = document.createElement('td');
          nameTd.textContent = cat.name;

          const descTd = document.createElement('td');
          descTd.textContent = cat.description || '-';

          const actionsTd = document.createElement('td');

          const editBtn = document.createElement('button');
          editBtn.className = 'btn btn-sm btn-outline';
          editBtn.textContent = '✏️';
          editBtn.onclick = () => this.edit(cat.id);

          const delBtn = document.createElement('button');
          delBtn.className = 'btn btn-sm btn-danger';
          delBtn.textContent = '🗑️';
          delBtn.onclick = () => this.remove(cat.id);

          actionsTd.appendChild(editBtn);
          actionsTd.appendChild(delBtn);

          tr.appendChild(nameTd);
          tr.appendChild(descTd);
          tr.appendChild(actionsTd);
          tbody.appendChild(tr);
        }
      },

      openCategoryModal(category = null) {
        this.editingId = category ? category.id : null;
        document.getElementById('category-modal-title').textContent = category ? 'Editar Categoria' : 'Nova Categoria';

        if (category) {
          document.getElementById('category-id').value = String(category.id);
          document.getElementById('category-name').value = category.name;
          document.getElementById('category-description').value = category.description || '';
        } else {
          document.getElementById('category-form').reset();
          document.getElementById('category-id').value = '';
        }

        deps.Modal.open('category-modal');
      },

      edit(categoryId) {
        const category = this.allCategories.find(c => c.id === categoryId);
        if (category) this.openCategoryModal(category);
      },

      async saveCategory() {
        const id = document.getElementById('category-id').value;
        const name = document.getElementById('category-name').value.trim();
        const description = document.getElementById('category-description').value.trim();

        try {
          if (id) {
            await window.electronAPI.updateCategory(deps.Session.getToken(), parseInt(id), { name, description });
            deps.Toast.success('Categoria atualizada!');
          } else {
            await window.electronAPI.createCategory(deps.Session.getToken(), { name, description });
            deps.Toast.success('Categoria criada!');
          }

          deps.Modal.close('category-modal');
          await this.load();
          await deps.POS.loadCategories();
        } catch (error) {
          console.error('Save category error:', error);
          deps.Toast.error('Erro ao salvar categoria: ' + (error.message || error));
        }
      },

      async remove(categoryId) {
        if (!confirm('Tem certeza que deseja excluir esta categoria?')) return;

        try {
          await window.electronAPI.deleteCategory(deps.Session.getToken(), categoryId);
          deps.Toast.success('Categoria excluída!');
          await this.load();
          await deps.POS.loadCategories();
        } catch (error) {
          console.error('Delete category error:', error);
          deps.Toast.error('Erro ao excluir categoria');
        }
      },
    },
  };
}
