import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { ChatInputCommandInteraction } from 'discord.js';
import { 
    handleSetHome, 
    handleSetWork, 
    handleSetSchedule, 
    handleFindCarpool, 
    handleStats, 
    handleNotify, 
    handleOut, 
    handleMessage, 
    handleSetOrganizer 
} from '../commands';
import { User, WorkLocation, WorkSchedule, CarpoolGroup, CarpoolMember } from '../database';
import NodeGeocoder from 'node-geocoder';
import { DateTime } from 'luxon';

// Mock the database models
const mockUser = {
    findByPk: async () => null,
    create: async () => ({ id: '123456789' }),
    findAll: async () => [],
    count: async () => 0,
};

const mockWorkLocation = {
    findOne: async () => null,
    create: async () => ({ id: 1 }),
    findAll: async () => [],
};

const mockWorkSchedule = {
    create: async () => ({ id: 1 }),
    findAll: async () => [],
};

const mockCarpoolGroup = {
    findOne: async () => null,
    create: async () => ({ id: 1 }),
    findAll: async () => [],
    count: async () => 0,
};

const mockCarpoolMember = {
    findOne: async () => null,
    update: async () => ({ id: 1 }),
    findAll: async () => [],
    count: async () => 0,
};

// Mock the geocoder
const mockGeocoder = {
    geocode: async () => [],
};

// Mock the webhook client
const mockWebhookClient = {
    send: async () => {},
};

describe('Command Handlers', () => {
    let mockInteraction;

    beforeEach(() => {
        mockInteraction = {
            options: {
                getString: () => '',
                getBoolean: () => false,
            },
            user: {
                id: '123456789',
                username: 'testuser',
            },
            reply: async () => {},
        };
    });

    describe('handleSetHome', () => {
        test('should handle invalid address', async () => {
            const geocoder = NodeGeocoder({ provider: 'openstreetmap' });
            geocoder.geocode = async () => [];
            mockInteraction.options.getString = () => 'invalid address';

            await handleSetHome(mockInteraction);

            assert.deepStrictEqual(
                mockInteraction.reply,
                {
                    content: 'Could not find the address. Please try again with a more specific address.',
                    ephemeral: true,
                }
            );
        });

        test('should successfully set home address', async () => {
            const geocoder = NodeGeocoder({ provider: 'openstreetmap' });
            geocoder.geocode = async () => [{
                latitude: 40.7128,
                longitude: -74.0060,
            }];
            mockInteraction.options.getString = () => 'New York, NY';
            User.create = async () => ({ id: '123456789' });

            await handleSetHome(mockInteraction);

            assert.deepStrictEqual(
                User.create,
                {
                    discordId: '123456789',
                    homeAddress: 'New York, NY',
                    homeLatitude: 40.7128,
                    homeLongitude: -74.0060,
                    notificationsEnabled: true,
                }
            );
            assert.deepStrictEqual(
                mockInteraction.reply,
                {
                    content: 'Successfully registered your home address! You can now set your work location and schedule.',
                    ephemeral: true,
                }
            );
        });
    });

    describe('handleSetWork', () => {
        it('should handle invalid work address', async () => {
            const mockGeocoder = NodeGeocoder({ provider: 'openstreetmap' });
            (mockGeocoder.geocode as jest.Mock).mockResolvedValue([]);
            (mockInteraction.options.getString as jest.Mock).mockImplementation((name) => 
                name === 'name' ? 'Office' : 'invalid address'
            );

            await handleSetWork(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Could not find the work address. Please try again with a more specific address.',
                ephemeral: true,
            });
        });

        it('should successfully set work location', async () => {
            const mockGeocoder = NodeGeocoder({ provider: 'openstreetmap' });
            (mockGeocoder.geocode as jest.Mock).mockResolvedValue([{
                latitude: 40.7128,
                longitude: -74.0060,
            }]);
            (mockInteraction.options.getString as jest.Mock).mockImplementation((name) => 
                name === 'name' ? 'Office' : 'New York, NY'
            );
            (WorkLocation.create as jest.Mock).mockResolvedValue({ id: 1 });

            await handleSetWork(mockInteraction);

            expect(WorkLocation.create).toHaveBeenCalledWith({
                name: 'Office',
                address: 'New York, NY',
                latitude: 40.7128,
                longitude: -74.0060,
            });
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Successfully set work location: Office',
                ephemeral: true,
            });
        });
    });

    describe('handleSetSchedule', () => {
        it('should handle invalid work location', async () => {
            (WorkLocation.findOne as jest.Mock).mockResolvedValue(null);
            (mockInteraction.options.getString as jest.Mock).mockImplementation((name) => {
                switch (name) {
                    case 'location': return 'Office';
                    case 'starttime': return '09:00';
                    case 'endtime': return '17:00';
                    case 'days': return '1,2,3,4,5';
                }
            });

            await handleSetSchedule(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Work location not found. Please set your work location first.',
                ephemeral: true,
            });
        });

        it('should handle invalid time format', async () => {
            (WorkLocation.findOne as jest.Mock).mockResolvedValue({ id: 1 });
            (mockInteraction.options.getString as jest.Mock).mockImplementation((name) => {
                switch (name) {
                    case 'location': return 'Office';
                    case 'starttime': return 'invalid';
                    case 'endtime': return '17:00';
                    case 'days': return '1,2,3,4,5';
                }
            });

            await handleSetSchedule(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Invalid time format. Please use 24-hour format (HH:mm)',
                ephemeral: true,
            });
        });

        it('should handle invalid days format', async () => {
            (WorkLocation.findOne as jest.Mock).mockResolvedValue({ id: 1 });
            (mockInteraction.options.getString as jest.Mock).mockImplementation((name) => {
                switch (name) {
                    case 'location': return 'Office';
                    case 'starttime': return '09:00';
                    case 'endtime': return '17:00';
                    case 'days': return 'invalid';
                }
            });

            await handleSetSchedule(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Invalid days format. Please provide numbers 1-7 separated by commas (1=Monday, 7=Sunday)',
                ephemeral: true,
            });
        });

        it('should successfully set schedule', async () => {
            (WorkLocation.findOne as jest.Mock).mockResolvedValue({ id: 1 });
            (mockInteraction.options.getString as jest.Mock).mockImplementation((name) => {
                switch (name) {
                    case 'location': return 'Office';
                    case 'starttime': return '09:00';
                    case 'endtime': return '17:00';
                    case 'days': return '1,2,3,4,5';
                }
            });
            (WorkSchedule.create as jest.Mock).mockResolvedValue({ id: 1 });

            await handleSetSchedule(mockInteraction);

            expect(WorkSchedule.create).toHaveBeenCalledWith({
                userId: '123456789',
                workLocationId: 1,
                startTime: '09:00',
                endTime: '17:00',
                daysOfWeek: '1,2,3,4,5',
            });
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Successfully set your work schedule!',
                ephemeral: true,
            });
        });
    });

    describe('handleSetOrganizer', () => {
        it('should require user registration', async () => {
            (User.findByPk as jest.Mock).mockResolvedValue(null);
            (mockInteraction.options.getString as jest.Mock).mockReturnValue('test-group');

            await handleSetOrganizer(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Please register first using /pool set-home',
                ephemeral: true,
            });
        });

        it('should require existing carpool group', async () => {
            (User.findByPk as jest.Mock).mockResolvedValue({ id: '123456789' });
            (CarpoolGroup.findOne as jest.Mock).mockResolvedValue(null);
            (mockInteraction.options.getString as jest.Mock).mockReturnValue('test-group');

            await handleSetOrganizer(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Carpool group not found. Please check the group name and try again.',
                ephemeral: true,
            });
        });

        it('should require user to be a member', async () => {
            (User.findByPk as jest.Mock).mockResolvedValue({ id: '123456789' });
            (CarpoolGroup.findOne as jest.Mock).mockResolvedValue({ id: 1 });
            (CarpoolMember.findOne as jest.Mock).mockResolvedValue(null);
            (mockInteraction.options.getString as jest.Mock).mockReturnValue('test-group');

            await handleSetOrganizer(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'You must be a member of the carpool group to become an organizer.',
                ephemeral: true,
            });
        });

        it('should successfully set user as organizer', async () => {
            const mockCarpoolGroup = { id: 1, name: 'test-group' };
            const mockMember = { update: jest.fn() };

            (User.findByPk as jest.Mock).mockResolvedValue({ id: '123456789' });
            (CarpoolGroup.findOne as jest.Mock).mockResolvedValue(mockCarpoolGroup);
            (CarpoolMember.findOne as jest.Mock).mockResolvedValue(mockMember);
            (mockInteraction.options.getString as jest.Mock).mockReturnValue('test-group');

            await handleSetOrganizer(mockInteraction);

            expect(mockMember.update).toHaveBeenCalledWith({ isOrganizer: true });
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'You are now an organizer for test-group!',
                ephemeral: true,
            });
        });

        it('should handle errors gracefully', async () => {
            (User.findByPk as jest.Mock).mockRejectedValue(new Error('Database error'));
            (mockInteraction.options.getString as jest.Mock).mockReturnValue('test-group');

            await handleSetOrganizer(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'There was an error setting you as an organizer. Please try again later.',
                ephemeral: true,
            });
        });
    });

    describe('handleFindCarpool', () => {
        it('should require user registration', async () => {
            (User.findByPk as jest.Mock).mockResolvedValue(null);

            await handleFindCarpool(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Please set your home address first using /pool set-home',
                ephemeral: true,
            });
        });

        it('should require work schedule', async () => {
            (User.findByPk as jest.Mock).mockResolvedValue({ id: '123456789' });
            (WorkSchedule.findAll as jest.Mock).mockResolvedValue([]);

            await handleFindCarpool(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Please set your work location and schedule first.',
                ephemeral: true,
            });
        });

        it('should find available carpools', async () => {
            const mockUser = { id: '123456789' };
            const mockSchedule = {
                workLocationId: 1,
                WorkLocation: { name: 'Office' },
            };
            const mockCarpool = {
                name: 'Morning Commute',
                maxSize: 4,
                CarpoolMembers: [{}, {}],
            };

            (User.findByPk as jest.Mock).mockResolvedValue(mockUser);
            (WorkSchedule.findAll as jest.Mock).mockResolvedValue([mockSchedule]);
            (CarpoolGroup.findAll as jest.Mock).mockResolvedValue([mockCarpool]);

            await handleFindCarpool(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalled();
            const replyCall = (mockInteraction.reply as jest.Mock).mock.calls[0][0];
            expect(replyCall.embeds[0].data.title).toBe('Available Carpools');
        });
    });

    describe('handleStats', () => {
        it('should display carpool statistics', async () => {
            (User.count as jest.Mock).mockResolvedValue(10);
            (CarpoolGroup.count as jest.Mock).mockResolvedValue(5);
            (CarpoolMember.count as jest.Mock).mockResolvedValue(20);

            await handleStats(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalled();
            const replyCall = (mockInteraction.reply as jest.Mock).mock.calls[0][0];
            expect(replyCall.embeds[0].data.title).toBe('Carpool Statistics');
            expect(replyCall.embeds[0].data.fields).toHaveLength(3);
        });
    });

    describe('handleNotify', () => {
        it('should require user registration', async () => {
            (User.findByPk as jest.Mock).mockResolvedValue(null);
            (mockInteraction.options.getBoolean as jest.Mock).mockReturnValue(true);

            await handleNotify(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Please set your home address first using /pool set-home',
                ephemeral: true,
            });
        });

        it('should update notification settings', async () => {
            const mockUser = { 
                id: '123456789',
                save: jest.fn(),
            };
            (User.findByPk as jest.Mock).mockResolvedValue(mockUser);
            (mockInteraction.options.getBoolean as jest.Mock).mockReturnValue(true);

            await handleNotify(mockInteraction);

            expect(mockUser.notificationsEnabled).toBe(true);
            expect(mockUser.save).toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Notifications enabled successfully!',
                ephemeral: true,
            });
        });
    });

    describe('handleOut', () => {
        it('should require user registration', async () => {
            (User.findByPk as jest.Mock).mockResolvedValue(null);
            (mockInteraction.options.getString as jest.Mock).mockImplementation((name) => {
                switch (name) {
                    case 'date': return '2024-01-01';
                    case 'reason': return 'Sick';
                }
            });

            await handleOut(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Please set your home address first using /pool set-home',
                ephemeral: true,
            });
        });

        it('should notify carpool members of absence', async () => {
            const mockUser = { id: '123456789' };
            const mockMembership = {
                carpoolGroupId: 1,
                CarpoolGroup: { name: 'Morning Commute' },
            };

            (User.findByPk as jest.Mock).mockResolvedValue(mockUser);
            (CarpoolMember.findAll as jest.Mock).mockResolvedValue([mockMembership]);
            (mockInteraction.options.getString as jest.Mock).mockImplementation((name) => {
                switch (name) {
                    case 'date': return '2024-01-01';
                    case 'reason': return 'Sick';
                }
            });

            await handleOut(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Your absence has been notified to all your carpool groups.',
                ephemeral: true,
            });
        });
    });

    describe('handleMessage', () => {
        it('should require user registration', async () => {
            (User.findByPk as jest.Mock).mockResolvedValue(null);
            (mockInteraction.options.getString as jest.Mock).mockReturnValue('Hello everyone!');

            await handleMessage(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Please set your home address first using /pool set-home',
                ephemeral: true,
            });
        });

        it('should send message to carpool groups', async () => {
            const mockUser = { id: '123456789' };
            const mockMembership = {
                carpoolGroupId: 1,
                CarpoolGroup: { name: 'Morning Commute' },
            };

            (User.findByPk as jest.Mock).mockResolvedValue(mockUser);
            (CarpoolMember.findAll as jest.Mock).mockResolvedValue([mockMembership]);
            (mockInteraction.options.getString as jest.Mock).mockReturnValue('Hello everyone!');

            await handleMessage(mockInteraction);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Your message has been sent to all your carpool groups.',
                ephemeral: true,
            });
        });
    });
}); 