import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as DiscordStrategy } from 'passport-discord';
import cors from 'cors';
import { User, WorkLocation, WorkSchedule, CarpoolMember, CarpoolGroup } from '../database.js';
import { CLIENT_ID, CLIENT_SECRET, SESSION_SECRET } from '../config.js';
import type { UserInstance } from '../types.js';

if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Missing Discord OAuth2 credentials');
}
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

passport.use(new DiscordStrategy({
    clientID: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    callbackURL: `http://localhost:3000/auth/discord/callback`,
    // callbackURL: `http://localhost:${PORT}/auth/discord/callback`,
    scope: ['identify', 'email']
}, async (accessToken: string, refreshToken: string, profile: any, done: (error: any, user?: UserInstance | false) => void) => {
    try {
        let user = await User.findOne({ where: { discordId: profile.id } });
        
        if (!user) {
            user = await User.create({
                id: profile.id,
                discordId: profile.id,
                homeAddress: '',
                homeLatitude: 0,
                homeLongitude: 0,
                notificationsEnabled: true
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

app.listen(PORT, () => {
    console.log(`Dashboard server running on port ${PORT}`);
}); 