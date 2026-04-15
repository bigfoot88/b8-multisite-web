import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, FormGroup, FormMessage, Icon, Label, Text } from '@adminjs/design-system';

function isImageAsset(asset) {
  return Boolean(asset?.mimeType && asset.mimeType.startsWith('image/'));
}

function looksSuspiciousLabel(value) {
  if (/[\u4e00-\u9fff]/u.test(value)) {
    return false;
  }

  let total = 0;
  let nonAscii = 0;

  for (const char of value) {
    if (/\s/u.test(char)) {
      continue;
    }

    total += 1;
    if ((char.codePointAt(0) || 0) > 127) {
      nonAscii += 1;
    }
  }

  return total > 0 && nonAscii / total > 0.35;
}

function resolveAssetLabel(asset) {
  const candidate = [asset?.displayName, asset?.altText, asset?.filename]
    .find((value) => typeof value === 'string' && value.trim().length > 0)
    ?.trim();

  if (!candidate) {
    return asset?.id ? `素材 #${asset.id}` : '素材';
  }

  if (looksSuspiciousLabel(candidate)) {
    return asset?.id ? `素材 #${asset.id}` : '素材';
  }

  return candidate;
}

function buildOptionsUrl(endpoint, selectedId, includeAssets) {
  const url = new URL(endpoint, typeof window === 'undefined' ? 'http://localhost' : window.location.origin);

  if (selectedId) {
    url.searchParams.set('selectedId', selectedId);
  }

  if (includeAssets) {
    url.searchParams.set('includeAssets', '1');
  }

  return typeof window === 'undefined'
    ? `${url.pathname}${url.search}`
    : url.toString();
}

function AssetPreview({ asset }) {
  const label = resolveAssetLabel(asset);
  const secondaryLabel = asset?.filename && asset.filename !== label && !looksSuspiciousLabel(asset.filename)
    ? asset.filename
    : asset?.mimeType || '当前素材';

  if (!asset) {
    return (
      <Box
        bg="bg"
        border="default"
        borderColor="grey20"
        borderRadius="lg"
        minHeight="120px"
        display="flex"
        alignItems="center"
        justifyContent="center"
        px="lg"
      >
        <Text color="grey60">未选择素材</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Box
        bg="bg"
        border="default"
        borderColor="grey20"
        borderRadius="lg"
        minHeight="160px"
        p="sm"
        overflow="hidden"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        {isImageAsset(asset)
          ? (
            <img
              src={asset.publicUrl || asset.sourceUrl || ''}
              alt={asset.altText || asset.displayName || asset.filename || ''}
              style={{ display: 'block', width: '100%', maxWidth: '100%', maxHeight: '220px', objectFit: 'contain' }}
            />
          )
          : (
            <Box textAlign="center" px="lg">
              <Icon icon="File" />
              <Text mt="sm">{label}</Text>
            </Box>
          )}
      </Box>
      <Text mt="sm" fontWeight="bold">{label}</Text>
      <Text color="grey60">{secondaryLabel}</Text>
    </Box>
  );
}

export default function MediaPickerEdit(props) {
  const { property, record, onChange } = props;
  const endpoint = property.custom?.mediaPickerEndpoint || '/admin-next/api/media/options';
  const uploadEndpoint = property.custom?.mediaUploadEndpoint || '/admin-next/api/media/inline-upload';
  const selectedValue = record.params?.[property.path];
  const selectedId = useMemo(() => {
    return selectedValue == null || selectedValue === '' ? '' : String(selectedValue);
  }, [selectedValue]);
  const error = record.errors?.[property.path];
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [assets, setAssets] = useState([]);
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [hasResolvedSelection, setHasResolvedSelection] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadAltText, setUploadAltText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const latestRequestRef = useRef(0);
  const invalidSelectionMessage = selectedId && hasResolvedSelection && !isLoading && !loadError && !selectedAsset
    ? '当前素材不存在或不在当前站点范围，请重新选择或清除。'
    : '';

  const loadOptions = useCallback(async ({ includeAssets }) => {
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;
    setIsLoading(true);
    setLoadError('');

    try {
      const response = await fetch(buildOptionsUrl(endpoint, selectedId, includeAssets), {
        credentials: 'same-origin',
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || '素材加载失败，请稍后重试。');
      }

      if (requestId !== latestRequestRef.current) {
        return;
      }

      setHasResolvedSelection(true);
      setSelectedAsset(payload?.selectedAsset || null);
      if (includeAssets) {
        setAssets(payload?.assets || []);
      }
    } catch (nextError) {
      if (requestId !== latestRequestRef.current) {
        return;
      }

      setHasResolvedSelection(true);
      setSelectedAsset(null);
      setLoadError(nextError.message);
      if (includeAssets) {
        setAssets([]);
      }
    } finally {
      if (requestId === latestRequestRef.current) {
        setIsLoading(false);
      }
    }
  }, [endpoint, selectedId]);

  const handleUploadSubmit = useCallback(async () => {
    if (!uploadFile) {
      setUploadError('请选择要上传的文件。');
      return;
    }

    setIsUploading(true);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      if (uploadAltText.trim()) {
        formData.append('altText', uploadAltText.trim());
      }

      const response = await fetch(uploadEndpoint, {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || '素材上传失败，请稍后重试。');
      }

      if (!payload?.id) {
        throw new Error('素材上传成功，但服务器没有返回可选择的素材 ID。');
      }

      const nextAsset = {
        id: payload.id,
        assetKey: payload.assetKey || String(payload.id),
        displayName: payload.displayName || payload.altText || payload.filename || `素材 #${payload.id}`,
        altText: payload.altText || '',
        filename: payload.filename || uploadFile.name,
        mimeType: payload.mimeType || uploadFile.type || '',
        publicUrl: payload.url || '',
        sourceUrl: payload.url || '',
      };

      latestRequestRef.current += 1;
      setHasResolvedSelection(true);
      setSelectedAsset(nextAsset);
      setAssets((currentAssets) => [nextAsset, ...currentAssets.filter((asset) => String(asset.id) !== String(payload.id))]);
      onChange(property.path, String(payload.id));
      setIsBrowserOpen(false);
      setUploadFile(null);
      setUploadAltText('');
    } catch (nextError) {
      setUploadError(nextError.message);
    } finally {
      setIsUploading(false);
    }
  }, [onChange, property.path, uploadAltText, uploadEndpoint, uploadFile]);

  useEffect(() => {
    if (!selectedId) {
      latestRequestRef.current += 1;
      setHasResolvedSelection(false);
      setSelectedAsset(null);
      setAssets([]);
      setIsLoading(false);
      setLoadError('');
      return;
    }

    setHasResolvedSelection(false);
    loadOptions({ includeAssets: false });
  }, [loadOptions, selectedId]);

  return (
    <FormGroup error={Boolean(error || loadError)}>
      <Label htmlFor={property.path}>{property.label}</Label>
      {property.description ? <Text mb="default" color="grey60">{property.description}</Text> : null}
      <input id={property.path} type="hidden" value={selectedId} readOnly />
      <Box border="default" borderColor="grey20" borderRadius="lg" p="lg">
        <AssetPreview asset={selectedAsset} />
        <Box mt="default" display="flex" flexWrap="wrap" gap="default">
          <Button
            type="button"
            variant="contained"
            onClick={async () => {
              const nextOpenState = !isBrowserOpen;
              setIsBrowserOpen(nextOpenState);
              if (nextOpenState) {
                await loadOptions({ includeAssets: true });
              }
            }}
          >
            选择素材
          </Button>
          <Button
            type="button"
            variant="light"
            disabled={!selectedId}
            onClick={() => {
              latestRequestRef.current += 1;
              setHasResolvedSelection(false);
              onChange(property.path, null);
              setSelectedAsset(null);
              setAssets([]);
              setIsBrowserOpen(false);
            }}
          >
            清除素材
          </Button>
        </Box>
        {isBrowserOpen ? (
          <Box mt="xl">
            <Text mb="default" color="grey60">仅显示当前站点及全局素材。</Text>
            <Box
              border="default"
              borderColor="grey20"
              borderRadius="lg"
              p="lg"
              mb="xl"
            >
              <Text fontWeight="bold">上传新素材</Text>
              <Text mt="xs" mb="default" color="grey60">上传后会自动回填当前字段并关闭选择器。</Text>
              <Box mb="default">
                <Label htmlFor={`${property.path}-media-upload-file`}>选择文件</Label>
                <input
                  id={`${property.path}-media-upload-file`}
                  type="file"
                  accept=".png,.jpg,.jpeg,.gif,.webp,.avif,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] || null;
                    setUploadFile(nextFile);
                    setUploadError('');
                  }}
                />
              </Box>
              <Box mb="default">
                <Label htmlFor={`${property.path}-media-upload-alt`}>替代文本</Label>
                <input
                  id={`${property.path}-media-upload-alt`}
                  type="text"
                  value={uploadAltText}
                  onChange={(event) => setUploadAltText(event.target.value)}
                />
              </Box>
              <Button type="button" variant="contained" disabled={isUploading} onClick={handleUploadSubmit}>
                {isUploading ? '上传中…' : '上传并选择'}
              </Button>
              <FormMessage>{uploadError}</FormMessage>
            </Box>
            {isLoading ? (
              <Text>素材加载中…</Text>
            ) : null}
            {!isLoading && assets.length === 0 ? (
              <Text color="grey60">当前站点暂无可选素材。</Text>
            ) : null}
            {!isLoading && assets.length > 0 ? (
              <Box display="grid" style={{ gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                {assets.map((asset) => (
                  <Box
                    key={asset.id}
                    as="button"
                    type="button"
                    border="default"
                    borderColor={String(asset.id) === selectedId ? 'primary100' : 'grey20'}
                    borderRadius="lg"
                    bg="white"
                    p="default"
                    textAlign="left"
                    onClick={() => {
                      latestRequestRef.current += 1;
                      setHasResolvedSelection(true);
                      onChange(property.path, String(asset.id));
                      setSelectedAsset(asset);
                      setIsBrowserOpen(false);
                      setUploadFile(null);
                      setUploadAltText('');
                      setUploadError('');
                    }}
                  >
                    <AssetPreview asset={asset} />
                  </Box>
                ))}
              </Box>
            ) : null}
          </Box>
        ) : null}
      </Box>
      <FormMessage>{error?.message || loadError || invalidSelectionMessage}</FormMessage>
    </FormGroup>
  );
}
