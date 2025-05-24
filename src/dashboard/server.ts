import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as DiscordStrategy } from 'passport-discord';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { User, WorkLocation, WorkSchedule, CarpoolMember, CarpoolGroup, sequelize } from '../database.js';
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

// Initialize database and associations
await sequelize.authenticate();
console.log('Database connection established successfully.');

// Define relationships
User.hasMany(WorkSchedule, { foreignKey: 'userId' });
WorkSchedule.belongsTo(User, { foreignKey: 'userId' });

WorkLocation.hasMany(WorkSchedule, { foreignKey: 'workLocationId' });
WorkSchedule.belongsTo(WorkLocation, { foreignKey: 'workLocationId' });

WorkLocation.hasMany(CarpoolGroup, { foreignKey: 'workLocationId' });
CarpoolGroup.belongsTo(WorkLocation, { foreignKey: 'workLocationId' });

// Add CarpoolGroup and CarpoolMember associations
CarpoolGroup.hasMany(CarpoolMember, { foreignKey: 'carpoolGroupId' });
CarpoolMember.belongsTo(CarpoolGroup, { foreignKey: 'carpoolGroupId' });
CarpoolMember.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(CarpoolMember, { foreignKey: 'userId' });

// Sync database with associations
await sequelize.sync({ alter: true });
console.log('Database models synchronized successfully.');

// Middleware
if (process.env.NODE_ENV === 'development')
    app.use(cors({
        origin: 'http://localhost:3000',
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
    if (!user) {
        console.error('No user object provided to serialize');
        return done(new Error('No user to serialize'));
    }
    // Store the discordId in the session
    done(null, user.discordId);
});

passport.deserializeUser(async (discordId: string, done) => {
    console.log('=== Deserialize User ===');
    console.log('Attempting to deserialize user with discordId:', discordId);
    try {
        const user = await User.findOne({ where: { discordId } });
        console.log('Found user:', user ? JSON.stringify(user.toJSON(), null, 2) : 'null');
        if (!user) {
            console.error('No user found for discordId:', discordId);
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
                discordId: profile.id,
                id: profile.id, // Use Discord ID as the primary key
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
            console.log('Updating existing user:', user.discordId);
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
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const user = await User.findOne({
            where: { discordId: (req.user as UserInstance).discordId },
            include: [{
                model: WorkSchedule,
                include: [WorkLocation],
                required: false // Allow users without schedules
            }]
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Return empty array if no schedules
        res.json(user.WorkSchedules || []);
    } catch (error) {
        console.error('Error fetching schedules:', error);
        res.status(500).json({ error: 'Failed to fetch schedules' });
    }
});

app.get('/api/carpools', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    console.log('req.user', req.user);

    try {
        const user = await User.findOne({
            where: { discordId: (req.user as UserInstance).discordId },
            include: [{
                model: CarpoolMember,
                include: [{
                    model: CarpoolGroup,
                    include: [WorkLocation]
                }],
                required: false // Allow users without carpool memberships
            }]
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Return empty array if no carpool memberships
        res.json(user.CarpoolMembers || []);
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
    console.log('=== Logout ===');
    console.log('Session before logout:', req.session);
    console.log('User before logout:', req.user);

    // Clear the session
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).json({ error: 'Failed to logout' });
        }

        // Clear the session cookie
        res.clearCookie('connect.sid', {
            httpOnly: true,
            secure: process.env.NODE_ENV !== 'development',
            sameSite: process.env.NODE_ENV === 'development' ? 'lax' : 'none',
            domain: process.env.NODE_ENV === 'development' ? 'localhost' : undefined
        });

        // Set CORS headers for the redirect
        if (process.env.NODE_ENV === 'development') {
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
        }

        // Redirect to the home page
        res.redirect(process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '/');
    });
});

// Serve static files from the dashboard build directory
const dashboardPath = path.resolve(__dirname, '../../dashboard/dist');
app.use(express.static(dashboardPath));

// Add a catch-all route to serve the dashboard's index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(dashboardPath, 'index.html'));
});

// Add a route to update user's address
app.put('/api/user/address', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const { address } = req.body;
        if (!address) {
            return res.status(400).json({ error: 'Address is required' });
        }

        // Use OpenStreetMap Nominatim service for geocoding
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
                address
            )}&limit=1`,
            {
                headers: {
                    'User-Agent': 'Coolio Discord Bot' // Required by Nominatim's usage policy
                }
            }
        );

        if (!response.ok) {
            throw new Error('Failed to geocode address');
        }

        const data = await response.json();
        if (!data || data.length === 0) {
            return res.status(400).json({ error: 'Invalid address' });
        }

        const { lat, lon } = data[0];

        // Update user's address and coordinates
        await User.update(
            {
                homeAddress: address,
                homeLatitude: parseFloat(lat),
                homeLongitude: parseFloat(lon),
            },
            {
                where: { discordId: (req.user as UserInstance).discordId },
            }
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating address:', error);
        res.status(500).json({ error: 'Failed to update address' });
    }
});

// Add a route to create a new schedule
app.post('/api/schedules', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const { workLocationId, startTime, endTime, daysOfWeek } = req.body;

        // Validate required fields
        if (!workLocationId || !startTime || !endTime || !daysOfWeek) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Validate time format (HH:mm)
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
            return res.status(400).json({ error: 'Invalid time format. Use HH:mm' });
        }

        // Validate days format (1-7, comma-separated)
        const daysRegex = /^[1-7](,[1-7])*$/;
        if (!daysRegex.test(daysOfWeek)) {
            return res.status(400).json({ error: 'Invalid days format. Use numbers 1-7 separated by commas' });
        }

        // Create the schedule
        const schedule = await WorkSchedule.create({
            userId: (req.user as UserInstance).discordId,
            workLocationId,
            startTime,
            endTime,
            daysOfWeek,
        });

        res.status(201).json(schedule);
    } catch (error) {
        console.error('Error creating schedule:', error);
        res.status(500).json({ error: 'Failed to create schedule' });
    }
});

// Add a route to delete a schedule
app.delete('/api/schedules/:id', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const scheduleId = parseInt(req.params.id);
        if (isNaN(scheduleId)) {
            return res.status(400).json({ error: 'Invalid schedule ID' });
        }

        // Find the schedule and ensure it belongs to the user
        const schedule = await WorkSchedule.findOne({
            where: {
                id: scheduleId,
                userId: (req.user as UserInstance).discordId,
            },
        });

        if (!schedule) {
            return res.status(404).json({ error: 'Schedule not found' });
        }

        // Delete the schedule
        await schedule.destroy();
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting schedule:', error);
        res.status(500).json({ error: 'Failed to delete schedule' });
    }
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