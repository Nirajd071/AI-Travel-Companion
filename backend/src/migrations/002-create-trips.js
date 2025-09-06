'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('trips', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      destination: {
        type: Sequelize.STRING,
        allowNull: false
      },
      destination_coordinates: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      start_date: {
        type: Sequelize.DATE,
        allowNull: false
      },
      end_date: {
        type: Sequelize.DATE,
        allowNull: false
      },
      budget: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      currency: {
        type: Sequelize.STRING(3),
        defaultValue: 'USD'
      },
      status: {
        type: Sequelize.ENUM('planning', 'confirmed', 'active', 'completed', 'cancelled'),
        defaultValue: 'planning'
      },
      is_public: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      share_code: {
        type: Sequelize.STRING,
        allowNull: true,
        unique: true
      },
      travel_style: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      preferences: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('trips', ['user_id']);
    await queryInterface.addIndex('trips', ['status']);
    await queryInterface.addIndex('trips', ['start_date']);
    await queryInterface.addIndex('trips', ['destination']);
    await queryInterface.addIndex('trips', ['share_code']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('trips');
  }
};
