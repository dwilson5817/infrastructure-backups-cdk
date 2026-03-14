import { HostGroupMap } from '../config/backups-hosts';

export function toResourceSuffix(hostname: string): string {
    return hostname.replace(/\./g, '-');
}

export function expandHostnames(hostsToGuests: HostGroupMap): string[] {
    return Object.entries(hostsToGuests).flatMap(([host, guests]) =>
        guests.map((guest) => `${guest}.${host}`)
    );
}