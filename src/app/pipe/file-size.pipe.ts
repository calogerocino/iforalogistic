import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'fileSize',
  standalone: true
})
export class FileSizePipe implements PipeTransform {
  transform(sizeInBytes: number | undefined | null, decimals: number = 2): string {
    if (sizeInBytes === null || sizeInBytes === undefined || isNaN(parseFloat(String(sizeInBytes))) || !isFinite(sizeInBytes) || sizeInBytes === 0) {
      return '0 Bytes';
    }

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(sizeInBytes) / Math.log(k));

    if (i >= sizes.length) { // Handle cases where size is extremely large
        return parseFloat((sizeInBytes / Math.pow(k, sizes.length -1 )).toFixed(dm)) + ' ' + sizes[sizes.length -1];
    }
    if (i < 0) { // Should not happen with positive numbers, but as a safeguard
        return '0 Bytes';
    }

    return parseFloat((sizeInBytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}
