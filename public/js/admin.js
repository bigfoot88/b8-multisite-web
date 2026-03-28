function getTinyMceConfig(textarea) {
  const uploadEndpoint = textarea.dataset.uploadEndpoint || '/admin/media/inline-upload';
  const siteKey = textarea.dataset.siteKey || '';

  return {
    target: textarea,
    language: 'zh_CN',
    language_url: 'https://cdn.jsdelivr.net/npm/tinymce@7.6.0/langs/zh_CN.js',
    menubar: false,
    branding: false,
    promotion: false,
    height: 520,
    resize: true,
    toolbar_mode: 'sliding',
    plugins: 'advlist autolink lists link image table code help wordcount',
    toolbar: [
      'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough',
      'forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent',
      'link image table | removeformat | code help',
    ].join(' | '),
    block_formats: '段落=p;标题 2=h2;标题 3=h3;引用=blockquote',
    font_family_formats: [
      '默认字体=Arial,Helvetica,sans-serif',
      '宋体=SimSun,serif',
      '黑体=SimHei,sans-serif',
      '楷体=KaiTi,serif',
      '微软雅黑=Microsoft YaHei,sans-serif',
      'Times New Roman=Times New Roman,serif',
      'Courier New=Courier New,monospace',
    ].join(';'),
    fontsize_formats: '12px 14px 16px 18px 24px 32px',
    images_file_types: 'jpg,jpeg,png,gif,webp,avif',
    automatic_uploads: true,
    convert_urls: false,
    relative_urls: false,
    remove_script_host: false,
    content_style: [
      'body { font-family: Arial, "Microsoft YaHei", sans-serif; font-size: 16px; line-height: 1.8; padding: 0 14px; color: #162033; }',
      'p, h1, h2, h3, h4, h5, h6, blockquote, ul, ol { margin: 0.5em 0; }',
      'img { max-width: 100%; height: auto; }',
    ].join('\n'),
    images_upload_handler: async (blobInfo) => {
      const formData = new FormData();
      formData.append('file', blobInfo.blob(), blobInfo.filename());
      if (siteKey) {
        formData.append('siteKey', siteKey);
      }
      formData.append('altText', blobInfo.filename().replace(/\.[^.]+$/, ''));

      const response = await fetch(uploadEndpoint, {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || '图片上传失败，请稍后重试。');
      }

      if (!payload?.url) {
        throw new Error('图片上传失败，服务器没有返回可用地址。');
      }

      return payload.url;
    },
    file_picker_types: 'image',
  };
}

document.addEventListener('DOMContentLoaded', () => {
  const editors = document.querySelectorAll('textarea[data-rich-text-editor]');
  if (editors.length && window.tinymce) {
    editors.forEach((textarea) => {
      window.tinymce.init(getTinyMceConfig(textarea));
    });
  }

  // ── Sidebar collapse ────────────────────────────────────────────────────
  const sidebarToggle = document.getElementById('sidebarToggle');
  if (sidebarToggle) {
    const STORAGE_KEY = 'admin_sidebar_collapsed';
    const shell = document.querySelector('body.admin-shell');
    if (localStorage.getItem(STORAGE_KEY) === '1') {
      shell.classList.add('admin-shell--sidebar-collapsed');
    }
    sidebarToggle.addEventListener('click', () => {
      const collapsed = shell.classList.toggle('admin-shell--sidebar-collapsed');
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    });
  }

  // ── List panel collapse (admin-grid with ?edit=) ─────────────────────────
  const adminGrid = document.querySelector('.admin-grid[data-collapsible]');
  if (adminGrid) {
    const params = new URLSearchParams(window.location.search);
    if (params.has('edit')) {
      adminGrid.classList.add('admin-grid--panel-collapsed');
    }

    const expandBtn = adminGrid.querySelector('[data-action="expand-list"]');
    if (expandBtn) {
      expandBtn.addEventListener('click', () => {
        adminGrid.classList.remove('admin-grid--panel-collapsed');
      });
    }

    const collapseBtn = adminGrid.querySelector('[data-action="collapse-list"]');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', () => {
        adminGrid.classList.add('admin-grid--panel-collapsed');
      });
    }
  }

  // ── Media picker modal ───────────────────────────────────────────────────
  document.querySelectorAll('[data-media-picker]').forEach((picker) => {
    const fieldName = picker.dataset.mediaPicker;
    const siteKey = picker.dataset.siteKey || '';
    const hiddenInput = picker.querySelector(`input[name="${fieldName}"]`);
    const previewEl = picker.querySelector('.media-picker__preview');
    const placeholderEl = picker.querySelector('.media-picker__placeholder');
    const openBtn = picker.querySelector('[data-action="open-media-picker"]');
    const clearBtn = picker.querySelector('[data-action="clear-media-picker"]');

    const modal = document.getElementById('mediaPickerModal');
    if (!modal || !openBtn) return;

    function updatePreview(url, altText) {
      if (url) {
        if (previewEl) {
          previewEl.src = url;
          previewEl.alt = altText || '';
          previewEl.style.display = 'block';
        }
        if (placeholderEl) placeholderEl.style.display = 'none';
      } else {
        if (previewEl) previewEl.style.display = 'none';
        if (placeholderEl) placeholderEl.style.display = '';
      }
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        hiddenInput.value = '';
        updatePreview('');
      });
    }

    openBtn.addEventListener('click', () => {
      modal.classList.add('is-open');
      modal.dataset.targetPicker = fieldName;

      const grid = modal.querySelector('.media-picker-modal__grid');
      const empty = modal.querySelector('.media-picker-modal__empty');
      grid.innerHTML = '';
      if (empty) empty.style.display = 'none';

      const url = `/admin/media/list-json${siteKey ? `?siteKey=${encodeURIComponent(siteKey)}` : ''}`;
      fetch(url)
        .then((r) => r.json())
        .then((data) => {
          const assets = data.assets || [];
          if (!assets.length) {
            if (empty) empty.style.display = '';
            return;
          }
          assets.forEach((asset) => {
            const item = document.createElement('div');
            item.className = 'media-picker-modal__item';
            if (String(hiddenInput.value) === String(asset.id)) {
              item.classList.add('is-selected');
            }
            item.dataset.id = asset.id;
            item.dataset.url = asset.publicUrl;
            item.dataset.alt = asset.altText || '';
            item.innerHTML = `<img src="${asset.publicUrl}" alt="${asset.altText || asset.filename || ''}" loading="lazy" /><div class="media-picker-modal__item-label">${asset.filename || asset.id}</div>`;
            item.addEventListener('click', () => {
              grid.querySelectorAll('.media-picker-modal__item').forEach((el) => el.classList.remove('is-selected'));
              item.classList.add('is-selected');
              hiddenInput.value = asset.id;
              updatePreview(asset.publicUrl, asset.altText);
              modal.classList.remove('is-open');
            });
            grid.appendChild(item);
          });
        })
        .catch(() => {
          if (empty) {
            empty.textContent = '加载失败，请重试';
            empty.style.display = '';
          }
        });
    });
  });

  const mediaModal = document.getElementById('mediaPickerModal');
  if (mediaModal) {
    mediaModal.querySelector('.media-picker-modal__close')?.addEventListener('click', () => {
      mediaModal.classList.remove('is-open');
    });
    mediaModal.addEventListener('click', (e) => {
      if (e.target === mediaModal) mediaModal.classList.remove('is-open');
    });
  }
});
