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
app.use(cors({
    origin: process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : undefined,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV !== 'development',
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'development' ? 'lax' : 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        domain: process.env.NODE_ENV === 'development' ? 'localhost' : undefined
    }
}));
app.use(passport.initialize());
app.use(passport.session());

// Add this before your routes
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    console.log('Cookies:', req.headers.cookie);
    next();
});

// Helper function to refresh Discord token
async function refreshDiscordToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const params = new URLSearchParams();
    params.append('client_id', CLIENT_ID || '');
    params.append('client_secret', CLIENT_SECRET || '');
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);

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

    return await response.json();
}

// Helper function to get fresh Discord profile
async function getDiscordProfile(accessToken: string): Promise<any> {
    const response = await fetch('https://discord.com/api/users/@me', {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        throw new Error('Failed to fetch profile');
    }

    return await response.json();
}

// Passport configuration
passport.serializeUser((user: any, done) => {
    console.log('=== Serialize User ===');
    console.log('User object:', JSON.stringify(user, null, 2));
    console.log('User type:', typeof user);
    console.log('User keys:', Object.keys(user));
    if (!user) {
        console.error('No user object provided to serialize');
        return done(new Error('No user to serialize'));
    }
    if (!user.id) {
        console.error('User object has no id property');
        return done(new Error('User has no id'));
    }
    console.log('Serializing user with id:', user.id);
    done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
    console.log('=== Deserialize User ===');
    console.log('Attempting to deserialize user with id:', id);
    try {
        const user = await User.findByPk(id);
        console.log('Found user:', user ? JSON.stringify(user.toJSON(), null, 2) : 'null');
        if (!user) {
            console.error('No user found for id:', id);
            return done(new Error('User not found'));
        }
        done(null, user);
    } catch (err) {
        console.error('Error deserializing user:', err);
        done(err);
    }
});

passport.use(new DiscordStrategy({
    clientID: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    callbackURL: process.env.NODE_ENV === 'development' 
        ? `http://localhost:3000/auth/discord/callback`
        : `http://localhost:${PORT}/auth/discord/callback`,
    scope: ['identify', 'email']
}, async (accessToken: string, refreshToken: string, profile: any, done: (error: any, user?: UserInstance | false) => void) => {
    console.log('=== Discord Strategy ===');
    console.log('Profile:', JSON.stringify(profile, null, 2));
    try {
        let user = await User.findOne({ where: { discordId: profile.id } });
        console.log('Existing user:', user ? JSON.stringify(user.toJSON(), null, 2) : 'null');
        
        if (!user) {
            console.log('Creating new user for Discord ID:', profile.id);
            user = await User.create({
                id: profile.id,
                discordId: profile.id,
                homeAddress: '',
                homeLatitude: 0,
                homeLongitude: 0,
                notificationsEnabled: true,
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
            console.log('Created new user:', JSON.stringify(user.toJSON(), null, 2));
        } else {
            console.log('Updating existing user:', user.id);
            // Update profile data
            await user.update({
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
            console.log('Updated user:', JSON.stringify(user.toJSON(), null, 2));
        }

        // Store tokens in session
        const req = (done as any).req;
        if (req && req.session) {
            req.session.accessToken = accessToken;
            req.session.refreshToken = refreshToken;
            req.session.tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        }
        
        console.log('Passport strategy completed with user:', JSON.stringify(user.toJSON(), null, 2));
        done(null, user);
    } catch (err) {
        console.error('Error in passport strategy:', err);
        done(err);
    }
}));

// Routes
app.get('/auth/discord', passport.authenticate('discord'));

app.get('/auth/discord/callback', 
    passport.authenticate('discord', { failureRedirect: '/login' }),
    (req, res) => {
        console.log('=== Auth Callback ===');
        console.log('Session:', req.session);
        console.log('User:', req.user);
        
        // Ensure the session is saved before redirecting
        req.session.save((err) => {
            if (err) {
                console.error('Error saving session:', err);
                return res.redirect('/login');
            }
            
            // Set CORS headers for the redirect
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
            res.redirect('http://localhost:3000/dashboard');
        });
    }
);

app.get('/debug/session', (req, res) => {
    console.log('=== Debug Session ===');
    console.log('Session:', req.session);
    console.log('User:', req.user);
    res.json({
        session: req.session,
        user: req.user
    });
});

app.get('/api/user', (req, res) => {
    console.log('=== API User ===');
    console.log('Session:', req.session);
    console.log('User:', req.user);
    console.log('Session ID:', req.sessionID);
    
    if (!req.user) {
        return res.status(401).json({ 
            error: 'Not authenticated',
            session: req.session,
            sessionID: req.sessionID
        });
    }
    
    // Set CORS headers for the response
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
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
        const session = (req as any).session;
        let accessToken = session.accessToken;

        // Check if token needs refresh
        if (new Date() >= session.tokenExpiresAt) {
            const tokens = await refreshDiscordToken(session.refreshToken);
            accessToken = tokens.accessToken;
            session.accessToken = tokens.accessToken;
            session.refreshToken = tokens.refreshToken;
            session.tokenExpiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
        }

        const profile = await getDiscordProfile(accessToken);
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

// Add a route to logout
app.get('/auth/logout', (req, res) => {
    req.logout(() => {
        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session:', err);
            }
            res.redirect('/');
        });
    });
});

// Serve static files from the dashboard build directory
const dashboardPath = path.resolve(__dirname, '../../dashboard/dist');
app.use(express.static(dashboardPath));

// Add a catch-all route to serve the dashboard's index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(dashboardPath, 'index.html'));
});

// Start the server
const server = app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
    console.log(`Development mode: ${process.env.NODE_ENV === 'development' ? 'enabled' : 'disabled'}`);
    console.log(`Dashboard URL: ${process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : `http://localhost:${PORT}`}`);
    console.log(`Callback URL: ${process.env.NODE_ENV === 'development' ? 'http://localhost:3000/auth/discord/callback' : `http://localhost:${PORT}/auth/discord/callback`}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
    });
}); 