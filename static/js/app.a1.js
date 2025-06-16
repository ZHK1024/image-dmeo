// AI 图片裁剪工具 JavaScript 文件

// 全局变量
let currentImage = null;
let cropMode = 'free'; // 'free' 或 'grid'
let cropBox = { x: 0, y: 0, width: 100, height: 100 };
let isDragging = false;
let dragHandle = null;
let startPos = { x: 0, y: 0 };
let croppedImages = [];
let imageScale = 1;
let imageOffset = { x: 0, y: 0 };
let currentLanguage = 'zh-CN'; // 当前语言

// DOM 元素
const elements = {
    imageInput: document.getElementById('imageInput'),
    dropZone: document.getElementById('dropZone'),
    imageCanvas: document.getElementById('imageCanvas'),
    imageContainer: document.getElementById('imageContainer'),
    emptyState: document.getElementById('emptyState'),
    freeCropBtn: document.getElementById('freeCropBtn'),
    gridCropBtn: document.getElementById('gridCropBtn'),
    gridSettings: document.getElementById('gridSettings'),
    gridRows: document.getElementById('gridRows'),
    gridCols: document.getElementById('gridCols'),
    downloadBtn: document.getElementById('downloadBtn'),
    resetBtn: document.getElementById('resetBtn'),
    cropOverlay: document.getElementById('cropOverlay'),
    freeCropBox: document.getElementById('freeCropBox'),
    gridOverlay: document.getElementById('gridOverlay'),
    imageInfo: document.getElementById('imageInfo'),
    urlModal: document.getElementById('urlModal'),
    imageUrlInput: document.getElementById('imageUrlInput'),
    urlLoadBtn: document.getElementById('urlLoadBtn'),
    urlConfirmBtn: document.getElementById('urlConfirmBtn'),
    urlCancelBtn: document.getElementById('urlCancelBtn'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    zoomInBtn: document.getElementById('zoomInBtn'),
    zoomOutBtn: document.getElementById('zoomOutBtn'),
    fitBtn: document.getElementById('fitBtn'),
    languageSelect: document.getElementById('languageSelect')
};

// 初始化
document.addEventListener('DOMContentLoaded', function () {
    initializeEventListeners();
    checkUrlParameter();
    initializeLanguage();
});

function initializeEventListeners() {
    // 文件上传
    elements.imageInput.addEventListener('change', handleImageUpload);

    // 画布区域拖拽上传
    elements.dropZone.addEventListener('dragover', handleDragOver);
    elements.dropZone.addEventListener('drop', handleDrop);
    elements.dropZone.addEventListener('dragenter', handleDragEnter);
    elements.dropZone.addEventListener('dragleave', handleDragLeave);

    // 上传触发按钮
    document.querySelectorAll('.upload-trigger').forEach(btn => {
        btn.addEventListener('click', () => elements.imageInput.click());
    });

    // 裁剪模式切换
    elements.freeCropBtn.addEventListener('click', () => setCropMode('free'));
    elements.gridCropBtn.addEventListener('click', () => setCropMode('grid'));

    // 网格设置变化
    elements.gridRows.addEventListener('input', () => {
        updateGridOverlay();
        updateGridTotal();
    });
    elements.gridCols.addEventListener('input', () => {
        updateGridOverlay();
        updateGridTotal();
    });            // 操作按钮
    elements.downloadBtn.addEventListener('click', downloadImages);
    elements.resetBtn.addEventListener('click', resetAll);

    // URL 加载
    elements.urlLoadBtn.addEventListener('click', () => elements.urlModal.classList.remove('hidden'));
    elements.urlConfirmBtn.addEventListener('click', loadImageFromUrl);
    elements.urlCancelBtn.addEventListener('click', () => elements.urlModal.classList.add('hidden'));

    // 拖拽功能
    initializeDragHandlers();

    // 缩放控制
    elements.zoomInBtn.addEventListener('click', () => zoomImage(1.2));
    elements.zoomOutBtn.addEventListener('click', () => zoomImage(0.8));
    elements.fitBtn.addEventListener('click', fitImageToContainer);

    // 语言切换
    elements.languageSelect.addEventListener('change', handleLanguageChange);

    // 模态框点击外部关闭
    elements.urlModal.addEventListener('click', (e) => {
        if (e.target === elements.urlModal) {
            elements.urlModal.classList.add('hidden');
        }
    });
}

window.setSourceImage = function (base64Image) {
    if (typeof base64Image === 'string' && base64Image.startsWith('data:image')) {
        // Call the new function specifically for base64 data
        if (typeof loadBase64ImageAndDisplay === 'function') {
            loadBase64ImageAndDisplay(base64Image, 'pasted_image.png');
        } else {
            console.error('loadBase64ImageAndDisplay function is not defined. Please ensure app.js is loaded correctly.');
        }
    } else {
        console.error('Invalid image data provided to setSourceImage. It must be a base64 string starting with \'data:image\'.');
        // Optionally, provide user feedback that the data was not a valid image.
    }
};

window.loadSourceImage = function (url) {
    if (!url) return Promise.reject(new Error('URL is empty'));

    showLoading();

    // 使用fetch来获取图片，设置no-referrer策略
    const proxyUrl = url.startsWith('http') ? url : 'https://' + url;

    return new Promise((resolve, reject) => {
        // 首先尝试直接获取
        fetch(proxyUrl, {
            method: 'GET',
            mode: 'cors',
            referrerPolicy: 'no-referrer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; ImageCropper/1.0)',
            }
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.blob();
            })
            .then(blob => {
                const img = new Image();
                const objectUrl = URL.createObjectURL(blob);

                img.onload = function () {
                    // 将图片绘制到canvas来获取数据
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);

                    // 获取base64数据
                    const dataUrl = canvas.toDataURL('image/png');
                    loadImage(dataUrl, 'image_from_url.png');

                    // 清理对象URL
                    URL.revokeObjectURL(objectUrl);
                    resolve(); // Resolve the promise on success
                };

                img.onerror = function () {
                    URL.revokeObjectURL(objectUrl);
                    tryFallbackMethod(); // Try fallback if direct load fails
                };

                img.src = objectUrl;
            })
            .catch(error => {
                console.log('Direct fetch failed, trying fallback method:', error);
                tryFallbackMethod();
            });

        function tryFallbackMethod() {
            // 回退方法：使用img标签加载，设置crossOrigin和referrerPolicy
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.referrerPolicy = 'no-referrer';

            img.onload = function () {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                const dataUrl = canvas.toDataURL('image/png');
                loadImage(dataUrl, 'image_from_url.png');
                resolve(); // Resolve the promise on success
            };

            img.onerror = function () {
                hideLoading();
                alert('无法加载图片，请检查URL是否正确。某些图片服务器可能禁止跨域访问。');
                reject(new Error('Failed to load image from URL')); // Reject the promise on failure
            };

            img.src = proxyUrl;
        }
    });
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        loadImageFromFile(file);
    }
}

function handleDragOver(event) {
    event.preventDefault();
    elements.dropZone.classList.add('drag-over');
}

function handleDragEnter(event) {
    event.preventDefault();
    elements.dropZone.classList.add('drag-over');
}

function handleDragLeave(event) {
    event.preventDefault();
    // 只有当离开整个dropZone时才移除样式
    if (!elements.dropZone.contains(event.relatedTarget)) {
        elements.dropZone.classList.remove('drag-over');
    }
}

function handleDrop(event) {
    event.preventDefault();
    elements.dropZone.classList.remove('drag-over');

    const files = event.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
        loadImageFromFile(files[0]);
    }
}

function loadImageFromFile(file) {
    showLoading();
    const reader = new FileReader();
    reader.onload = function (e) {
        loadImage(e.target.result, file.name);
    };
    reader.readAsDataURL(file);
}

function loadImageFromUrl() {
    const url = elements.imageUrlInput.value.trim();
    if (!url) return;

    elements.urlModal.classList.add('hidden');

    window.loadSourceImage(url).catch(error => {
        // Error handling is done within loadSourceImage (alert)
        // Additional error handling can be done here if needed
        console.error("Error in loadImageFromUrl:", error);
    });
}

function loadBase64ImageAndDisplay(base64Data, filename = 'image_from_base64.png') {
    showLoading(); // Show loading indicator
    loadImage(base64Data, filename);
}

function loadImage(src, filename = 'image') {
    const img = new Image();
    img.onload = function () {
        currentImage = {
            element: img,
            src: src,
            filename: filename,
            width: img.width,
            height: img.height
        };

        displayImage();
        enableControls();
        hideLoading();
    };
    // Added onerror handler for better debugging
    img.onerror = function () {
        console.error("Error loading image. Source (first 100 chars):", typeof src === 'string' ? src.substring(0, 100) : '[source not a string]');
        hideLoading(); // Ensure loading indicator is hidden on error
        alert('Failed to load image data. Please ensure it is a valid image format and the data is correct.');
    };
    img.src = src;
}

function displayImage() {
    if (!currentImage) return;

    const canvas = elements.imageCanvas;
    const ctx = canvas.getContext('2d');

    // 设置画布尺寸
    canvas.width = currentImage.width;
    canvas.height = currentImage.height;

    // 绘制图片
    ctx.drawImage(currentImage.element, 0, 0);

    // 显示图片容器，隐藏空状态
    elements.emptyState.classList.add('hidden');
    elements.imageContainer.classList.remove('hidden');

    // 更新图片信息
    elements.imageInfo.textContent = `${currentImage.filename} (${currentImage.width} × ${currentImage.height})`;

    // 适应容器
    fitImageToContainer();

    // 初始化裁剪区域
    initializeCropArea();
}

function initializeCropArea() {
    // 设置默认裁剪框覆盖整张图片
    const canvasRect = elements.imageCanvas.getBoundingClientRect();
    const containerRect = elements.imageContainer.getBoundingClientRect();

    const offsetX = canvasRect.left - containerRect.left;
    const offsetY = canvasRect.top - containerRect.top;

    // 裁剪区域覆盖整张图片，留出小边距
    const margin = Math.min(canvasRect.width, canvasRect.height) * 0.02; // 2%的边距

    cropBox = {
        x: offsetX + margin,
        y: offsetY + margin,
        width: canvasRect.width - (margin * 2),
        height: canvasRect.height - (margin * 2)
    };

    updateCropDisplay();
}

function setCropMode(mode) {
    cropMode = mode;

    // 更新按钮状态
    if (mode === 'free') {
        elements.freeCropBtn.classList.add('active');
        elements.gridCropBtn.classList.remove('active');
        elements.gridSettings.classList.add('hidden');
    } else {
        elements.gridCropBtn.classList.add('active');
        elements.freeCropBtn.classList.remove('active');
        elements.gridSettings.classList.remove('hidden');
        // 更新网格总数
        updateGridTotal();
    }

    updateCropDisplay();
}

function updateCropDisplay() {
    if (!currentImage) return;

    elements.cropOverlay.classList.remove('hidden');

    if (cropMode === 'free') {
        elements.freeCropBox.classList.remove('hidden');
        elements.gridOverlay.classList.add('hidden');
        updateFreeCropBox();
    } else {
        elements.freeCropBox.classList.add('hidden');
        elements.gridOverlay.classList.remove('hidden');
        updateGridOverlay();
    }
}

function updateFreeCropBox() {
    const box = elements.freeCropBox;
    box.style.left = cropBox.x + 'px';
    box.style.top = cropBox.y + 'px';
    box.style.width = cropBox.width + 'px';
    box.style.height = cropBox.height + 'px';
}

function updateGridOverlay() {
    const rows = parseInt(elements.gridRows.value);
    const cols = parseInt(elements.gridCols.value);
    const canvasRect = elements.imageCanvas.getBoundingClientRect();
    const containerRect = elements.imageContainer.getBoundingClientRect();

    const offsetX = canvasRect.left - containerRect.left;
    const offsetY = canvasRect.top - containerRect.top;

    const cellWidth = canvasRect.width / cols;
    const cellHeight = canvasRect.height / rows;

    const overlay = elements.gridOverlay;
    overlay.style.left = offsetX + 'px';
    overlay.style.top = offsetY + 'px';
    overlay.style.width = canvasRect.width + 'px';
    overlay.style.height = canvasRect.height + 'px';
    overlay.style.backgroundSize = `${cellWidth}px ${cellHeight}px`;
}

// 更新网格总数显示
function updateGridTotal() {
    const rows = parseInt(elements.gridRows.value) || 2;
    const cols = parseInt(elements.gridCols.value) || 2;
    const total = rows * cols;
    const gridTotalElement = document.getElementById('gridTotal');
    if (gridTotalElement) {
        gridTotalElement.textContent = total;
        // 添加动画效果
        gridTotalElement.style.transform = 'scale(1.1)';
        setTimeout(() => {
            gridTotalElement.style.transform = 'scale(1)';
        }, 200);
    }
}

function initializeDragHandlers() {
    const handles = elements.freeCropBox.querySelectorAll('.drag-handle');

    handles.forEach(handle => {
        handle.addEventListener('mousedown', startDrag);
    });

    elements.freeCropBox.addEventListener('mousedown', startMove);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
}

function startDrag(event) {
    event.stopPropagation();
    isDragging = true;
    dragHandle = event.target.classList[1]; // 获取方向类名
    startPos = { x: event.clientX, y: event.clientY };
    event.preventDefault();
}

function startMove(event) {
    if (event.target.classList.contains('drag-handle')) return;

    isDragging = true;
    dragHandle = 'move';
    startPos = { x: event.clientX, y: event.clientY };
    event.preventDefault();
}

function drag(event) {
    if (!isDragging) return;

    const deltaX = event.clientX - startPos.x;
    const deltaY = event.clientY - startPos.y;

    if (dragHandle === 'move') {
        cropBox.x += deltaX;
        cropBox.y += deltaY;
    } else {
        resizeCropBox(dragHandle, deltaX, deltaY);
    }

    constrainCropBox();
    updateFreeCropBox();

    startPos = { x: event.clientX, y: event.clientY };
}

function stopDrag() {
    isDragging = false;
    dragHandle = null;
}

function resizeCropBox(direction, deltaX, deltaY) {
    const minSize = 20;

    switch (direction) {
        case 'nw':
            cropBox.x += deltaX;
            cropBox.y += deltaY;
            cropBox.width -= deltaX;
            cropBox.height -= deltaY;
            break;
        case 'ne':
            cropBox.y += deltaY;
            cropBox.width += deltaX;
            cropBox.height -= deltaY;
            break;
        case 'sw':
            cropBox.x += deltaX;
            cropBox.width -= deltaX;
            cropBox.height += deltaY;
            break;
        case 'se':
            cropBox.width += deltaX;
            cropBox.height += deltaY;
            break;
        case 'n':
            cropBox.y += deltaY;
            cropBox.height -= deltaY;
            break;
        case 's':
            cropBox.height += deltaY;
            break;
        case 'w':
            cropBox.x += deltaX;
            cropBox.width -= deltaX;
            break;
        case 'e':
            cropBox.width += deltaX;
            break;
    }

    // 确保最小尺寸
    if (cropBox.width < minSize) {
        if (direction.includes('w')) cropBox.x -= (minSize - cropBox.width);
        cropBox.width = minSize;
    }
    if (cropBox.height < minSize) {
        if (direction.includes('n')) cropBox.y -= (minSize - cropBox.height);
        cropBox.height = minSize;
    }
}

function constrainCropBox() {
    const canvasRect = elements.imageCanvas.getBoundingClientRect();
    const containerRect = elements.imageContainer.getBoundingClientRect();

    const offsetX = canvasRect.left - containerRect.left;
    const offsetY = canvasRect.top - containerRect.top;
    const maxX = offsetX + canvasRect.width;
    const maxY = offsetY + canvasRect.height;

    // 约束位置和尺寸
    cropBox.x = Math.max(offsetX, Math.min(cropBox.x, maxX - cropBox.width));
    cropBox.y = Math.max(offsetY, Math.min(cropBox.y, maxY - cropBox.height));
    cropBox.width = Math.min(cropBox.width, maxX - cropBox.x);
    cropBox.height = Math.min(cropBox.height, maxY - cropBox.y);
}

function performCrop() {
    if (!currentImage) return;

    showLoading();
    croppedImages = [];

    setTimeout(() => {
        if (cropMode === 'free') {
            performFreeCrop();
        } else {
            performGridCrop();
        }

        elements.downloadBtn.disabled = false;
        hideLoading();
    }, 100);
}

function performFreeCrop() {
    const canvasRect = elements.imageCanvas.getBoundingClientRect();
    const containerRect = elements.imageContainer.getBoundingClientRect();

    const offsetX = canvasRect.left - containerRect.left;
    const offsetY = canvasRect.top - containerRect.top;

    // 计算在原图中的裁剪区域
    const scaleX = currentImage.width / canvasRect.width;
    const scaleY = currentImage.height / canvasRect.height;

    const cropX = (cropBox.x - offsetX) * scaleX;
    const cropY = (cropBox.y - offsetY) * scaleY;
    const cropWidth = cropBox.width * scaleX;
    const cropHeight = cropBox.height * scaleY;

    const croppedCanvas = document.createElement('canvas');
    const ctx = croppedCanvas.getContext('2d');

    croppedCanvas.width = cropWidth;
    croppedCanvas.height = cropHeight;

    ctx.drawImage(
        currentImage.element,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, cropWidth, cropHeight
    );

    croppedImages.push({
        canvas: croppedCanvas,
        name: `${currentImage.filename.split('.')[0]}_cropped.png`
    });
}

function performGridCrop() {
    const rows = parseInt(elements.gridRows.value);
    const cols = parseInt(elements.gridCols.value);

    const cellWidth = currentImage.width / cols;
    const cellHeight = currentImage.height / rows;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const cropX = col * cellWidth;
            const cropY = row * cellHeight;

            const croppedCanvas = document.createElement('canvas');
            const ctx = croppedCanvas.getContext('2d');

            croppedCanvas.width = cellWidth;
            croppedCanvas.height = cellHeight;

            ctx.drawImage(
                currentImage.element,
                cropX, cropY, cellWidth, cellHeight,
                0, 0, cellWidth, cellHeight
            );

            croppedImages.push({
                canvas: croppedCanvas,
                name: `${currentImage.filename.split('.')[0]}_${row + 1}_${col + 1}.png`
            });
        }
    }
} function downloadImages() {
    if (!currentImage) {
        alert('请先上传图片');
        return;
    }

    // 直接执行裁剪并下载
    showLoading();
    croppedImages = [];

    setTimeout(() => {
        if (cropMode === 'free') {
            performFreeCrop();
        } else {
            performGridCrop();
        }

        // 下载裁剪后的图片
        if (croppedImages.length === 0) {
            hideLoading();
            alert('裁剪失败，请重试');
            return;
        }

        croppedImages.forEach((img, index) => {
            setTimeout(() => {
                const link = document.createElement('a');
                link.download = img.name;
                link.href = img.canvas.toDataURL('image/png');
                link.click();
            }, index * 100); // 延迟下载避免浏览器阻止
        });

        hideLoading();
    }, 100);
}

function resetAll() {
    currentImage = null;
    croppedImages = [];
    imageScale = 1;
    imageOffset = { x: 0, y: 0 };

    elements.imageContainer.classList.add('hidden');
    elements.emptyState.classList.remove('hidden');
    elements.cropOverlay.classList.add('hidden');
    elements.imageInfo.textContent = '请上传图片开始裁剪';

    disableControls();
} function enableControls() {
    elements.downloadBtn.disabled = false;
    elements.resetBtn.disabled = false;
    elements.zoomInBtn.disabled = false;
    elements.zoomOutBtn.disabled = false;
    elements.fitBtn.disabled = false;
}

function disableControls() {
    elements.downloadBtn.disabled = true;
    elements.resetBtn.disabled = true;
    elements.zoomInBtn.disabled = true;
    elements.zoomOutBtn.disabled = true;
    elements.fitBtn.disabled = true;
}

function zoomImage(factor) {
    imageScale *= factor;
    imageScale = Math.max(0.1, Math.min(imageScale, 5));

    const canvas = elements.imageCanvas;
    canvas.style.transform = `scale(${imageScale}) translate(${imageOffset.x}px, ${imageOffset.y}px)`;

    // 更新裁剪区域显示
    setTimeout(() => {
        if (currentImage) {
            updateCropDisplay();
        }
    }, 50);
}

function fitImageToContainer() {
    imageScale = 1;
    imageOffset = { x: 0, y: 0 };

    const canvas = elements.imageCanvas;
    canvas.style.transform = 'scale(1) translate(0px, 0px)';

    setTimeout(() => {
        if (currentImage) {
            initializeCropArea();
        }
    }, 50);
}

function showLoading() {
    elements.loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    elements.loadingOverlay.classList.add('hidden');
}

function checkUrlParameter() {
    const urlParams = new URLSearchParams(window.location.search);
    const imageUrl = urlParams.get('usource');

    if (imageUrl) {
        elements.imageUrlInput.value = imageUrl;
        loadImageFromUrl();
    }
}

// 键盘快捷键
document.addEventListener('keydown', function (event) {
    if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
            case 'o':
                event.preventDefault();
                elements.imageInput.click();
                break;
            case 's':
                event.preventDefault();
                if (!elements.downloadBtn.disabled) {
                    downloadImages();
                }
                break;
            case 'r':
                event.preventDefault();
                if (!elements.resetBtn.disabled) {
                    resetAll();
                }
                break;
        }
    }

    // ESC 关闭模态框
    if (event.key === 'Escape') {
        elements.urlModal.classList.add('hidden');
    }
});

// 窗口大小变化时重新计算布局
window.addEventListener('resize', function () {
    if (currentImage) {
        setTimeout(() => {
            updateCropDisplay();
        }, 100);
    }
});

// 语言切换处理函数
function handleLanguageChange(event) {
    const selectedLanguage = event.target.value;
    currentLanguage = selectedLanguage;

    // 保存语言选择到本地存储
    localStorage.setItem('preferred-language', selectedLanguage);

    // 这里后续会添加实际的语言切换逻辑
    console.log('Language changed to:', selectedLanguage);

    // 触发自定义事件，方便后续扩展
    document.dispatchEvent(new CustomEvent('languageChanged', {
        detail: { language: selectedLanguage }
    }));
}

// 初始化语言设置
function initializeLanguage() {
    const savedLanguage = localStorage.getItem('preferred-language');
    if (savedLanguage && elements.languageSelect) {
        elements.languageSelect.value = savedLanguage;
        currentLanguage = savedLanguage;
    }
}

/// 发送消息到父窗口
function sendMessage() {
    /// 从当前页面中获取 vid 参数
    const urlParams = new URLSearchParams(window.location.search);
    const vid = urlParams.get('vid');
    const action = parseInt(urlParams.get('a') || '0');
    console.log('发送消息', vid, action);
    if (vid && action) {
        window.postMessage({ type: 'message', action: action, vid: vid }, '*');
    }
}