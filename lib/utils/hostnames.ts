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