// ==UserScript==
// @name            Odoo Bulk Image Downloader
// @name:tr         Odoo Toplu Görsel İndirme Eklentisi
// @namespace       https://github.com/sipsak
// @version         1.0
// @description     Adds a feature to Odoo to bulk download images of selected products on the products page
// @description:tr  Odoo'ya ürünler sayfasında seçilen ürünlerin görsellerini toplu bir şekilde indirme özelliği ekler
// @author          Burak Şipşak
// @match           https://portal.bskhvac.com.tr/*
// @match           https://*.odoo.com/*
// @icon            https://raw.githubusercontent.com/sipsak/odoo-image-enlarger/refs/heads/main/icon.png
// @updateURL       https://raw.githubusercontent.com/sipsak/Odoo-Bulk-Image-Downloader/main/Odoo-Bulk-Image-Downloader.user.js
// @downloadURL     https://raw.githubusercontent.com/sipsak/Odoo-Bulk-Image-Downloader/main/Odoo-Bulk-Image-Downloader.user.js
// ==/UserScript==

(function() {
    'use strict';

    let downloadInProgress = false;

    // Ürünler sayfasında olup olmadığımızı kontrol eder
    function isInProductPage() {
        return window.location.href.includes('model=product.template');
    }

    // Progress bar'ı oluşturur (belirtilen tasarım)
    function createProgressBar() {
        let progressContainer = document.getElementById("download-progress-container");
        if (!progressContainer) {
            progressContainer = document.createElement("div");
            progressContainer.id = "download-progress-container";
            progressContainer.style.position = "fixed";
            progressContainer.style.bottom = "20px";
            progressContainer.style.left = "50%";
            progressContainer.style.transform = "translateX(-50%)";
            progressContainer.style.background = "rgba(0, 0, 0, 0.8)";
            progressContainer.style.color = "white";
            progressContainer.style.padding = "10px";
            progressContainer.style.borderRadius = "5px";
            progressContainer.style.fontSize = "14px";
            progressContainer.style.zIndex = "9999";
            progressContainer.style.width = "300px";
            progressContainer.style.textAlign = "center";

            const progressText = document.createElement("div");
            progressText.id = "download-progress-text";
            progressText.textContent = "İşlem devam ediyor... (0%)";
            progressContainer.appendChild(progressText);

            const progressBar = document.createElement("div");
            progressBar.id = "download-progress-bar";
            progressBar.style.width = "100%";
            progressBar.style.background = "#444";
            progressBar.style.borderRadius = "3px";
            progressBar.style.marginTop = "5px";

            const progressFill = document.createElement("div");
            progressFill.id = "download-progress-fill";
            progressFill.style.height = "8px";
            progressFill.style.width = "0%";
            progressFill.style.background = "#4CAF50";
            progressFill.style.borderRadius = "3px";

            progressBar.appendChild(progressFill);
            progressContainer.appendChild(progressBar);
            document.body.appendChild(progressContainer);
        }
    }

    // Progress bar'ı günceller
    function updateProgress(percentage) {
        const progressText = document.getElementById("download-progress-text");
        const progressFill = document.getElementById("download-progress-fill");
        if(progressText && progressFill) {
            const percent = Math.round(percentage);
            progressText.textContent = `İşlem devam ediyor... (${percent}%)`;
            progressFill.style.width = `${percent}%`;
        }
    }

    // Progress bar'ı kaldırır
    function removeProgressBar() {
        const container = document.getElementById("download-progress-container");
        if(container) container.remove();
    }

    // Dosya indirmeyi tetikler
    function downloadFile(blob, filename) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
    }

    // JSZip kütüphanesini dinamik yükler
    function loadJSZip() {
        return new Promise((resolve, reject) => {
            if (typeof JSZip !== 'undefined') {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.7.1/jszip.min.js";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('JSZip yüklenemedi.'));
            document.head.appendChild(script);
        });
    }

    // İndirme işlemini başlatır
    async function startDownload() {
        if (downloadInProgress) {
            alert('Önce mevcut işlemin tamamlanmasını bekleyin');
            return;
        }
        downloadInProgress = true;
        createProgressBar();
        updateProgress(0);

        // Seçili ürün satırlarını alır
        const selectedRows = document.querySelectorAll(
            'tr.o_data_row.o_row_draggable.o_data_row_selected, tr.o_data_row.o_row_draggable.table-info.o_data_row_selected'
        );
        if (selectedRows.length === 0) {
            alert('Lütfen en az bir ürün seçin.');
            downloadInProgress = false;
            removeProgressBar();
            return;
        }

        const products = [];
        for (const row of selectedRows) {
            const idCell = row.querySelector('td[name="id"]');
            const barcodeCell = row.querySelector('td[name="barcode"]');
            if (!idCell) {
                alert('Bu özelliğin çalışması için ID sütununu göstermeniz gerekir.');
                downloadInProgress = false;
                removeProgressBar();
                return;
            }
            const productId = idCell.innerText.trim();
            const barcode = barcodeCell ? barcodeCell.innerText.trim() : productId;
            if (productId) {
                products.push({ id: productId, barcode: barcode });
            }
        }

        const total = products.length;
        if (total === 1) {
            // Tek ürün için direkt görsel indirir
            const { id, barcode } = products[0];
            const imageUrl = `https://portal.bskhvac.com.tr/web/image?model=product.template&id=${id}&field=image_1920`;
            try {
                const response = await fetch(imageUrl);
                const blob = await response.blob();
                updateProgress(100);
                downloadFile(blob, `${barcode}.jpg`);
            } catch(e) {
                alert('İndirme sırasında hata oluştu.');
            }
        } else {
            // Çoklu ürün için ZIP dosyası oluşturur
            try {
                await loadJSZip();
            } catch(e) {
                alert(e.message);
                downloadInProgress = false;
                removeProgressBar();
                return;
            }
            const zip = new JSZip();
            for (let i = 0; i < total; i++) {
                const { id, barcode } = products[i];
                const imageUrl = `https://portal.bskhvac.com.tr/web/image?model=product.template&id=${id}&field=image_1920`;
                try {
                    const response = await fetch(imageUrl);
                    const blob = await response.blob();
                    zip.file(`${barcode}.jpg`, blob);
                } catch(e) {
                    console.error(`Ürün ${id} için indirme hatası:`, e);
                }
                updateProgress(((i + 1) / total) * 100);
            }
            zip.generateAsync({ type: "blob" }, metadata => {
                updateProgress(metadata.percent);
            }).then(content => {
                downloadFile(content, `urunler.zip`);
            });
        }

        setTimeout(() => {
            removeProgressBar();
            downloadInProgress = false;
        }, 2000);
    }

    // Ürünler sayfasına buton ekler
    function addImageDownloadButton() {
        const menus = document.querySelectorAll('.o_cp_action_menus .dropdown-menu');
        menus.forEach(menu => {
            if (menu.closest('.o_control_panel_breadcrumbs_actions')) return;
            if (menu.querySelector('.image-download-button')) return;

            const button = document.createElement('span');
            button.className = 'dropdown-item o_menu_item image-download-button';
            button.setAttribute('role', 'menuitem');
            button.setAttribute('tabindex', '0');
            button.innerHTML = `<i class="fa fa-download me-1 fa-fw oi-fw"></i>Görselleri indir`;

            menu.prepend(button);

            button.addEventListener('mouseenter', () => {
                document.querySelectorAll('.o_menu_item.focus').forEach(el => {
                    el.classList.remove('focus');
                });
                button.classList.add('focus');
            });

            button.addEventListener('mouseleave', () => {
                button.classList.remove('focus');
            });

            button.addEventListener('click', () => {
                startDownload();
            });
        });
    }

    // URL ve buton kontrollerini yapar
    let lastUrl = location.href;
    function checkUrlAndButtons() {
        if(location.href !== lastUrl) {
            lastUrl = location.href;
        }
        if(isInProductPage()) {
            addImageDownloadButton();
        }
    }

    const observer = new MutationObserver(checkUrlAndButtons);
    observer.observe(document.body, { childList: true, subtree: true });
    ['load', 'DOMContentLoaded'].forEach(event => {
        window.addEventListener(event, checkUrlAndButtons);
    });
    setInterval(checkUrlAndButtons, 1000);
})();
