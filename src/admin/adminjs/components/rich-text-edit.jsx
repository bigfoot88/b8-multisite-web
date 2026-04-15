import React from 'react';
import { FormGroup, FormMessage, TinyMCE } from '@adminjs/design-system';

const defaultToolbar = [
  'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough',
  'forecolor backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent',
  'link image table | removeformat | code help',
].join(' | ');

const defaultPlugins = 'advlist autolink lists link image table code help wordcount';
const defaultContentStyle = [
  'body { font-family: Arial, "Microsoft YaHei", sans-serif; font-size: 16px; line-height: 1.8; padding: 0 14px; color: #162033; }',
  'p, h1, h2, h3, h4, h5, h6, blockquote, ul, ol { margin: 0.5em 0; }',
  'img { max-width: 100%; height: auto; }',
].join('\n');

export default function RichTextEdit(props) {
  const { property, record, onChange } = props;
  const value = record.params?.[property.path] || '';
  const error = record.errors?.[property.path];
  const uploadEndpoint = property.custom?.uploadEndpoint || '/admin-next/api/media/inline-upload';
  const tinymceScriptSrc = property.custom?.tinymceScriptSrc || '/admin-next/frontend/assets/tinymce/tinymce.min.js';
  const tinymceLanguageUrl = property.custom?.tinymceLanguageUrl || '/admin-next/frontend/assets/tinymce/langs/zh_CN.js';

  const options = {
    tinymceScriptSrc,
    init: {
      language: 'zh_CN',
      language_url: tinymceLanguageUrl,
      menubar: false,
      branding: false,
      promotion: false,
      height: 520,
      resize: true,
      toolbar_mode: 'sliding',
      plugins: defaultPlugins,
      toolbar: defaultToolbar,
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
      content_style: defaultContentStyle,
      images_upload_handler: async (blobInfo) => {
        const formData = new FormData();
        formData.append('file', blobInfo.blob(), blobInfo.filename());

        const response = await fetch(uploadEndpoint, {
          method: 'POST',
          body: formData,
          credentials: 'same-origin',
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
    },
  };

  return (
    <FormGroup error={Boolean(error)}>
      <label htmlFor={property.path}>{property.label}</label>
      <TinyMCE
        value={value}
        onChange={(nextValue) => onChange(property.path, nextValue)}
        options={options}
      />
      <FormMessage>{error?.message}</FormMessage>
    </FormGroup>
  );
}
