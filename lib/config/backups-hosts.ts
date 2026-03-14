export type HostGroupMap = Record<string, string[]>;

export const hostsToBackup: HostGroupMap = {
    'london.dylanw.net': ['git01', 'sql01', 'web01', 'mail01', 'game01', 'game02'],
};