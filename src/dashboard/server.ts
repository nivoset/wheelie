import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as DiscordStrategy } from 'passport-discord';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { User, WorkLocation, WorkSchedule, CarpoolMember, CarpoolGroup } from '../database.js';
import { CLIENT_ID, CLIENT_SECRET, SESSION_SECRET } from '../config.js';
import type { UserInstance } from '../types.js';

if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Missing Discord OAuth2 credentials');
}

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Start server
const PORT = process.env.PORT || 8080;
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// Serve static files from the dashboard build directory
const dashboardPath = path.resolve(__dirname, '../../dashboard/dist');
app.use(express.static(dashboardPath));

// Passport configuration
passport.serializeUser((user: any, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
    try {
        const user = await User.findByPk(id);
        done(null, user);
    } catch (err) {
        done(err);
    }
});

// Helper function to refresh Discord token
async function refreshDiscordToken(user: UserInstance): Promise<void> {
    try {
        const params = new URLSearchParams();
        params.append('client_id', CLIENT_ID || '');
        params.append('client_secret', CLIENT_SECRET || '');
        params.append('grant_type', 'refresh_token');
        params.append('refresh_token', user.refreshToken);

        const response = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            body: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        if (!response.ok) {
            throw new Error('Failed to refresh token');
        }

        const data = await response.json();
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + data.expires_in);

        await user.update({
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            tokenExpiresAt: expiresAt,
        });
    } catch (error) {
        console.error('Error refreshing token:', error);
        throw error;
    }
}

// Helper function to get fresh Discord profile
async function getDiscordProfile(user: UserInstance): Promise<any> {
    try {
        // Check if token needs refresh
        if (new Date() >= user.tokenExpiresAt) {
            await refreshDiscordToken(user);
        }

        const response = await fetch('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${user.accessToken}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch profile');
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching profile:', error);
        throw error;
    }
}

passport.use(new DiscordStrategy({
    clientID: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    callbackURL: process.env.NODE_ENV === 'development' 
        ? `http://localhost:3000/auth/discord/callback`
        : `http://localhost:${PORT}/auth/discord/callback`,
    scope: ['identify', 'email']
}, async (accessToken: string, refreshToken: string, profile: any, done: (error: any, user?: UserInstance | false) => void) => {
    try {
        let user = await User.findOne({ where: { discordId: profile.id } });
        
        // Calculate token expiration (usually 7 days)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        
        if (!user) {
            user = await User.create({
                id: profile.id,
                discordId: profile.id,
                homeAddress: '',
                homeLatitude: 0,
                homeLongitude: 0,
                notificationsEnabled: true,
                // Store tokens
                accessToken,
                refreshToken,
                tokenExpiresAt: expiresAt,
                // Profile data
                username: profile.username,
                avatar: profile.avatar,
                discriminator: profile.discriminator,
                public_flags: profile.public_flags,
                flags: profile.flags,
                banner: profile.banner,
                accent_color: profile.accent_color,
                global_name: profile.global_name,
                avatar_decoration_data: profile.avatar_decoration_data,
                collectibles: profile.collectibles,
                banner_color: profile.banner_color,
                clan: profile.clan,
                primary_guild: profile.primary_guild,
                mfa_enabled: profile.mfa_enabled,
                locale: profile.locale,
                premium_type: profile.premium_type,
                email: profile.email,
                verified: profile.verified
            });
        } else {
            // Update tokens and profile data
            await user.update({
                accessToken,
                refreshToken,
                tokenExpiresAt: expiresAt,
                username: profile.username,
                avatar: profile.avatar,
                discriminator: profile.discriminator,
                public_flags: profile.public_flags,
                flags: profile.flags,
                banner: profile.banner,
                accent_color: profile.accent_color,
                global_name: profile.global_name,
                avatar_decoration_data: profile.avatar_decoration_data,
                collectibles: profile.collectibles,
                banner_color: profile.banner_color,
                clan: profile.clan,
                primary_guild: profile.primary_guild,
                mfa_enabled: profile.mfa_enabled,
                locale: profile.locale,
                premium_type: profile.premium_type,
                email: profile.email,
                verified: profile.verified
            });
        }
        
        done(null, user);
    } catch (err) {
        done(err);
    }
}));

// Routes
app.get('/auth/discord', passport.authenticate('discord'));
app.get('/auth/discord/callback', 
    passport.authenticate('discord', { failureRedirect: '/login' }),
    (req, res) => {
        res.redirect('/dashboard');
    }
);

app.get('/api/user', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json(req.user);
});

app.get('/api/schedules', async (req, res) => {
    try {
        const user = await User.findOne({
            // @ts-expect-error typing of express issue
            where: { discordId: req.user?.id },
            include: [{
                model: WorkSchedule,
                include: [WorkLocation]
            }]
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // @ts-expect-error typing of express issue
        res.json(user.WorkSchedules);
    } catch (error) {
        console.error('Error fetching schedules:', error);
        res.status(500).json({ error: 'Failed to fetch schedules' });
    }
});

app.get('/api/carpools', async (req, res) => {
    try {
        const user = await User.findOne({
            // @ts-expect-error typing of express issue
            where: { discordId: req.user?.id },
            include: [{
                model: CarpoolMember,
                include: [{
                    model: CarpoolGroup,
                    include: [WorkLocation]
                }]
            }]
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // @ts-expect-error typing of express issue
        res.json(user.CarpoolMembers);
    } catch (error) {
        console.error('Error fetching carpools:', error);
        res.status(500).json({ error: 'Failed to fetch carpools' });
    }
});

app.get('/api/offices', async (req, res) => {
    try {
        const offices = await WorkLocation.findAll({
            include: [{
                model: WorkSchedule,
                include: [{
                    model: User,
                    include: [{
                        model: CarpoolMember,
                        include: [CarpoolGroup]
                    }]
                }]
            }]
        });
        res.json(offices);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch offices' });
    }
});

// Add a route to refresh user data
app.get('/api/user/refresh', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const profile = await getDiscordProfile(req.user as UserInstance);
        await (req.user as UserInstance).update({
            username: profile.username,
            avatar: profile.avatar,
            discriminator: profile.discriminator,
            public_flags: profile.public_flags,
            flags: profile.flags,
            banner: profile.banner,
            accent_color: profile.accent_color,
            global_name: profile.global_name,
            avatar_decoration_data: profile.avatar_decoration_data,
            collectibles: profile.collectibles,
            banner_color: profile.banner_color,
            clan: profile.clan,
            primary_guild: profile.primary_guild,
            mfa_enabled: profile.mfa_enabled,
            locale: profile.locale,
            premium_type: profile.premium_type,
            email: profile.email,
            verified: profile.verified
        });
        res.json(req.user);
    } catch (error) {
        console.error('Error refreshing user data:', error);
        res.status(500).json({ error: 'Failed to refresh user data' });
    }
});

// Add a catch-all route to serve the dashboard's index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(dashboardPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Dashboard server running on port ${PORT}`);
}); 