import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { ChatInputCommandInteraction, CommandInteraction, CacheType, CommandInteractionOptionResolver, ApplicationCommandType } from 'discord.js';
import { 
    handleSetHome, 
    handleSetOffice, 
    handleSetSchedule, 
    handleFindCarpool, 
    handleStats, 
    handleNotify, 
    handleOut, 
    handleMessage, 
    handleSetOrganizer 
} from '../commands.js';
import { User, WorkLocation, WorkSchedule, CarpoolGroup, CarpoolMember } from '../database.js';
import NodeGeocoder from 'node-geocoder';
import { DateTime } from 'luxon';

// Mock the database models
jest.mock('../database.js', () => ({
  User: {
    findByPk: jest.fn(),
    create: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn(),
  },
  WorkLocation: {
    findOne: jest.fn(),
    create: jest.fn(),
    findAll: jest.fn(),
  },
  WorkSchedule: {
    create: jest.fn(),
    findAll: jest.fn(),
  },
  CarpoolGroup: {
    findOne: jest.fn(),
    create: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn(),
  },
  CarpoolMember: {
    findOne: jest.fn(),
    update: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn(),
  },
}));

// Mock NodeGeocoder
jest.mock('node-geocoder', () => {
  return jest.fn().mockImplementation(() => ({
    geocode: jest.fn(),
  }));
});

describe('Command Handlers', () => {
  let mockInteraction: Partial<ChatInputCommandInteraction>;

  beforeEach(() => {
    mockInteraction = {
      reply: jest.fn(),
      deferReply: jest.fn(),
      editReply: jest.fn(),
      options: {
        getString: jest.fn(),
        getBoolean: jest.fn(),
        get: jest.fn(),
        data: {
            // @ts-expect-error
          options: []
        },
        resolved: {},
        getSubcommand: jest.fn(),
        getSubcommandGroup: jest.fn(),
        getChannel: jest.fn(),
        getRole: jest.fn(),
        getUser: jest.fn(),
        getMember: jest.fn(),
        getMentionable: jest.fn(),
        getNumber: jest.fn(),
        getInteger: jest.fn(),
        getAttachment: jest.fn()
      },
      // @ts-expect-error
      user: {
        id: '123456789',
        username: 'testuser'
      },
      client: {
        // @ts-expect-error
        user: {
          tag: 'testbot#1234'
        }
      },
      _cacheType: {} as CacheType,
      transformOption: jest.fn(),
      commandType: ApplicationCommandType.ChatInput,
      // @ts-expect-error
      inGuild: jest.fn(),
      // @ts-expect-error
      inCachedGuild: jest.fn(),
      // @ts-expect-error
      inRawGuild: jest.fn(),
      type: 2,
    };
  });

  describe('handleSetHome', () => {
    test('should handle invalid address', async () => {
      const geocoder = NodeGeocoder({ provider: 'openstreetmap' });
      (geocoder.geocode as jest.Mock).mockResolvedValue([]);
      (mockInteraction.options?.getString as jest.Mock).mockReturnValue('invalid address');

      await handleSetHome(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: 'Could not find the address. Please try again with a more specific address.',
        ephemeral: true,
      });
    });

    test('should successfully set home address', async () => {
      const geocoder = NodeGeocoder({ provider: 'openstreetmap' });
      (geocoder.geocode as jest.Mock).mockResolvedValue([{
        latitude: 40.7128,
        longitude: -74.0060,
      }]);
      (mockInteraction.options?.getString as jest.Mock).mockReturnValue('New York, NY');
      (User.create as jest.Mock).mockResolvedValue({ id: '123456789' });

      await handleSetHome(mockInteraction as ChatInputCommandInteraction);

      expect(User.create).toHaveBeenCalledWith({
        discordId: '123456789',
        homeAddress: 'New York, NY',
        homeLatitude: 40.7128,
        homeLongitude: -74.0060,
        notificationsEnabled: true,
      });
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: 'Successfully registered your home address! You can now set your work location and schedule.',
        ephemeral: true,
      });
    });
  });

  describe('handleSetOffice', () => {
    test('should handle invalid work address', async () => {
      const geocoder = NodeGeocoder({ provider: 'openstreetmap' });
      (geocoder.geocode as jest.Mock).mockResolvedValue([]);
      (mockInteraction.options?.getString as jest.Mock).mockImplementation((name: string) => 
        name === 'name' ? 'Office' : 'invalid address'
      );

      await handleSetOffice(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: 'Could not find the work address. Please try again with a more specific address.',
        ephemeral: true,
      });
    });

    test('should successfully set work location', async () => {
      const geocoder = NodeGeocoder({ provider: 'openstreetmap' });
      (geocoder.geocode as jest.Mock).mockResolvedValue([{
        latitude: 40.7128,
        longitude: -74.0060,
      }]);
      (mockInteraction.options?.getString as jest.Mock).mockImplementation((name: string) => 
        name === 'name' ? 'Office' : 'New York, NY'
      );
      (WorkLocation.create as jest.Mock).mockResolvedValue({ id: 1 });

      await handleSetOffice(mockInteraction as ChatInputCommandInteraction);

      expect(WorkLocation.create).toHaveBeenCalledWith({
        name: 'Office',
        address: 'New York, NY',
        latitude: 40.7128,
        longitude: -74.0060,
      });
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: 'Successfully set your work location! You can now set your work schedule.',
        ephemeral: true,
      });
    });
  });

  describe('handleSetSchedule', () => {
    it('should handle invalid work location', async () => {
      (WorkLocation.findOne as jest.Mock).mockResolvedValue(null);
      (mockInteraction.options!.getString as jest.Mock).mockImplementation((name) => {
        switch (name) {
          case 'location': return 'Office';
          case 'starttime': return '09:00';
          case 'endtime': return '17:00';
          case 'days': return '1,2,3,4,5';
        }
      });

      await handleSetSchedule(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: 'Work location not found. Please set your work location first.',
        ephemeral: true,
      });
    });

    it('should handle invalid time format', async () => {
      (WorkLocation.findOne as jest.Mock).mockResolvedValue({ id: 1 });
      (mockInteraction.options!.getString as jest.Mock).mockImplementation((name) => {
        switch (name) {
          case 'location': return 'Office';
          case 'starttime': return 'invalid';
          case 'endtime': return '17:00';
          case 'days': return '1,2,3,4,5';
        }
      });

      await handleSetSchedule(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: 'Invalid time format. Please use 24-hour format (HH:mm)',
        ephemeral: true,
      });
    });

    it('should handle invalid days format', async () => {
      (WorkLocation.findOne as jest.Mock).mockResolvedValue({ id: 1 });
      (mockInteraction.options!.getString as jest.Mock).mockImplementation((name) => {
        switch (name) {
          case 'location': return 'Office';
          case 'starttime': return '09:00';
          case 'endtime': return '17:00';
          case 'days': return 'invalid';
        }
      });

      await handleSetSchedule(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: 'Invalid days format. Please provide numbers 1-7 separated by commas (1=Monday, 7=Sunday)',
        ephemeral: true,
      });
    });

    it('should successfully set schedule', async () => {
      (WorkLocation.findOne as jest.Mock).mockResolvedValue({ id: 1 });
      (mockInteraction.options!.getString as jest.Mock).mockImplementation((name) => {
        switch (name) {
          case 'location': return 'Office';
          case 'starttime': return '09:00';
          case 'endtime': return '17:00';
          case 'days': return '1,2,3,4,5';
        }
      });
      (WorkSchedule.create as jest.Mock).mockResolvedValue({ id: 1 });

      await handleSetSchedule(mockInteraction as ChatInputCommandInteraction);

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
      (mockInteraction.options!.getString as jest.Mock).mockReturnValue('test-group');

      await handleSetOrganizer(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: 'Please register first using /pool set-home',
        ephemeral: true,
      });
    });

    it('should require existing carpool group', async () => {
      (User.findByPk as jest.Mock).mockResolvedValue({ id: '123456789' });
      (CarpoolGroup.findOne as jest.Mock).mockResolvedValue(null);
      (mockInteraction.options!.getString as jest.Mock).mockReturnValue('test-group');

      await handleSetOrganizer(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: 'Carpool group not found. Please check the group name and try again.',
        ephemeral: true,
      });
    });

    it('should require user to be a member', async () => {
      (User.findByPk as jest.Mock).mockResolvedValue({ id: '123456789' });
      (CarpoolGroup.findOne as jest.Mock).mockResolvedValue({ id: 1 });
      (CarpoolMember.findOne as jest.Mock).mockResolvedValue(null);
      (mockInteraction.options!.getString as jest.Mock).mockReturnValue('test-group');

      await handleSetOrganizer(mockInteraction as ChatInputCommandInteraction);

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
      (mockInteraction.options!.getString as jest.Mock).mockReturnValue('test-group');

      await handleSetOrganizer(mockInteraction as ChatInputCommandInteraction);

      expect(mockMember.update).toHaveBeenCalledWith({ isOrganizer: true });
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: 'You are now an organizer for test-group!',
        ephemeral: true,
      });
    });

    it('should handle errors gracefully', async () => {
      (User.findByPk as jest.Mock).mockRejectedValue(new Error('Database error'));
      (mockInteraction.options!.getString as jest.Mock).mockReturnValue('test-group');

      await handleSetOrganizer(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: 'There was an error setting you as an organizer. Please try again later.',
        ephemeral: true,
      });
    });
  });

  describe('handleFindCarpool', () => {
    it('should require user registration', async () => {
      (User.findByPk as jest.Mock).mockResolvedValue(null);

      await handleFindCarpool(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: 'Please set your home address first using /pool set-home',
        ephemeral: true,
      });
    });

    it('should require work schedule', async () => {
      (User.findByPk as jest.Mock).mockResolvedValue({ id: '123456789' });
      (WorkSchedule.findAll as jest.Mock).mockResolvedValue([]);

      await handleFindCarpool(mockInteraction as ChatInputCommandInteraction);

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

      await handleFindCarpool(mockInteraction as ChatInputCommandInteraction);

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

      await handleStats(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.reply).toHaveBeenCalled();
      const replyCall = (mockInteraction.reply as jest.Mock).mock.calls[0][0];
      expect(replyCall.embeds[0].data.title).toBe('Carpool Statistics');
      expect(replyCall.embeds[0].data.fields).toHaveLength(3);
    });
  });

  describe('handleNotify', () => {
    it('should require user registration', async () => {
      (User.findByPk as jest.Mock).mockResolvedValue(null);
      (mockInteraction.options!.getBoolean as jest.Mock).mockReturnValue(true);

      await handleNotify(mockInteraction as ChatInputCommandInteraction);

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
      (mockInteraction.options!.getBoolean as jest.Mock).mockReturnValue(true);

      await handleNotify(mockInteraction as ChatInputCommandInteraction);
      // @ts-expect-error
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
      (mockInteraction.options!.getString as jest.Mock).mockImplementation((name) => {
        switch (name) {
          case 'date': return '2024-01-01';
          case 'reason': return 'Sick';
        }
      });

      await handleOut(mockInteraction as ChatInputCommandInteraction);

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
      (mockInteraction.options!.getString as jest.Mock).mockImplementation((name) => {
        switch (name) {
          case 'date': return '2024-01-01';
          case 'reason': return 'Sick';
        }
      });

      await handleOut(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: 'Your absence has been notified to all your carpool groups.',
        ephemeral: true,
      });
    });
  });

  describe('handleMessage', () => {
    it('should require user registration', async () => {
      (User.findByPk as jest.Mock).mockResolvedValue(null);
      (mockInteraction.options!.getString as jest.Mock).mockReturnValue('Hello everyone!');

      await handleMessage(mockInteraction as ChatInputCommandInteraction);

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
      (mockInteraction.options!.getString as jest.Mock).mockReturnValue('Hello everyone!');

      await handleMessage(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: 'Your message has been sent to all your carpool groups.',
        ephemeral: true,
      });
    });
  });
}); 