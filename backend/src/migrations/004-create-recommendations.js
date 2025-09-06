'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('recommendations', {
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
      trip_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'trips',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      type: {
        type: Sequelize.ENUM('destination', 'activity', 'restaurant', 'accommodation', 'transport'),
        allowNull: false
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      location: {
        type: Sequelize.STRING,
        allowNull: true
      },
      coordinates: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      price_range: {
        type: Sequelize.STRING,
        allowNull: true
      },
      rating: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: true
      },
      confidence_score: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: false,
        defaultValue: 0.5
      },
      ai_reasoning: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      external_data: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      user_feedback: {
        type: Sequelize.ENUM('liked', 'disliked', 'saved', 'ignored'),
        allowNull: true
      },
      feedback_reason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
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
    await queryInterface.addIndex('recommendations', ['user_id']);
    await queryInterface.addIndex('recommendations', ['trip_id']);
    await queryInterface.addIndex('recommendations', ['type']);
    await queryInterface.addIndex('recommendations', ['confidence_score']);
    await queryInterface.addIndex('recommendations', ['user_feedback']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('recommendations');
  }
};
