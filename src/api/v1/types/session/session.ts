
export type Role = 'host' | 'admin' | 'guest'

export type DeviceType = 'web' | 'mobile'

export type PassportSession = {
    passport: {
        user: string;
    };
    csrf: string;
    fcmToken: string;
    lastModified: Date;
    role: Role,
    deviceType: DeviceType,
    userRole: Role[]
}