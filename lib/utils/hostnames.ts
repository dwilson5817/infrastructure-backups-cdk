import { HostGroupMap } from '../config/backups-hosts';

export function toResourceSuffix(hostname: string): string {
    return hostname
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

export function expandHostnames(hostsToBackup: HostGroupMap): string[] {
    return Object.entries(hostsToBackup).flatMap(([host, guests]) =>
        guests.map((guest) => `${guest}.${host}`)
    );
}

export function hostnameToPascalCase(hostname: string): string {
    return hostname
        .split(/[.\-_]/)        // split on dots, hyphens, underscores
        .filter(Boolean)        // drop empty segments
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
}