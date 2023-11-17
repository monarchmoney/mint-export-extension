import { exportDailyHistory } from './export';
import { getElement } from './get-element';
import { whenMintSectionActive } from './mint-navigation';
import { getCurrentTrendState, isSupportedTrendReport } from './trend-state';

let isExporting = false;

// Export daily balance link to add to the trends page
const exportDailyLink = document.createElement('a');
exportDailyLink.innerHTML =
  '<span style="mix-blend-mode: multiply">Export Daily History to CSV</span>';
exportDailyLink.id = 'export-daily';
exportDailyLink.style.borderRadius = '4px';
exportDailyLink.style.marginLeft = '8px';
exportDailyLink.addEventListener('click', async (event) => {
  event.preventDefault();
  // pointerEvents: none should prevent multiple clicks, but just in case
  if (!isExporting) {
    isExporting = true;
    await exportDailyHistory({
      trend: getCurrentTrendState(),
      onProgress: (progress) => {
        updateExportProgressBar(progress);
      },
    });
    isExporting = false;
  }
});

/** Sets the background gradient of the export daily button to indicate data pull progress. */
export const updateExportProgressBar = (progress?: number) => {
  if (progress != null) {
    const percent = progress * 100;
    exportDailyLink.style.pointerEvents = 'none';
    exportDailyLink.style.background = `linear-gradient(to right, #1b8381 ${percent}%, #f4f5f8 ${percent}%)`;
  } else {
    exportDailyLink.style.pointerEvents = 'unset';
    exportDailyLink.style.background = 'white';
  }
};

/**
 * Adds the daily export link after Mint's Export CSV link if not already present and updates
 * its status.
 */
const addExportLink = async () => {
  if (!document.contains(exportDailyLink)) {
    const exportLink = await getElement('[data-automation-id=export-csv]');
    exportDailyLink.className = exportLink.className;
    updateExportProgressBar();
    if (!document.getElementById('export-daily')) {
      exportLink.after(exportDailyLink);
    }
  }
  const { reportType } = getCurrentTrendState();
  if (isSupportedTrendReport(reportType)) {
    exportDailyLink.style.pointerEvents = 'unset';
    exportDailyLink.style.opacity = '1';
  } else {
    exportDailyLink.style.pointerEvents = 'none';
    exportDailyLink.style.opacity = '0.25';
  }
};

let exportLinkInterval: NodeJS.Timer;

whenMintSectionActive({
  section: 'trends',
  onActivated: () => {
    clearInterval(exportLinkInterval);
    exportLinkInterval = setInterval(addExportLink, 1000);
  },
  onDeactivated: () => {
    clearInterval(exportLinkInterval);
  },
});
