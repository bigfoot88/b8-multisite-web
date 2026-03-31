const { sites } = require('../../config/sites');

const publishStates = ['draft', 'published', 'archived'];

function createNewsArticleModel(sequelize, DataTypes) {
  if (sequelize.models.NewsArticle) {
    return sequelize.models.NewsArticle;
  }

  const NewsArticle = sequelize.define('NewsArticle', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    site_key: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [sites],
      },
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    body_html: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    hero_media_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    seo_title: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    seo_description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 100,
    },
    publish_state: {
      type: DataTypes.ENUM(...publishStates),
      allowNull: false,
      defaultValue: 'draft',
      validate: {
        isIn: [publishStates],
      },
    },
    published_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'news_articles',
    timestamps: false,
    hooks: {
      beforeValidate(record) {
        const publishState = record.get('publish_state');

        if (publishState === 'published' && !record.get('published_at')) {
          record.set('published_at', new Date());
        }

        if (publishState !== 'published') {
          record.set('published_at', null);
        }

        record.set('updated_at', new Date());
      },
    },
  });

  return NewsArticle;
}

function createNewsArticleResource(sequelize, DataTypes) {
  const NewsArticle = createNewsArticleModel(sequelize, DataTypes);

  return {
    resource: NewsArticle,
    options: {
      navigation: {
        name: 'Content',
        icon: 'Document',
      },
      properties: {
        id: {
          isVisible: { edit: false, filter: true, list: true, show: true },
        },
        site_key: {
          availableValues: sites.map((value) => ({ value, label: value })),
        },
        slug: {
          isTitle: false,
        },
        title: {
          isTitle: true,
        },
        summary: {
          type: 'textarea',
        },
        body_html: {
          type: 'textarea',
        },
        publish_state: {
          availableValues: publishStates.map((value) => ({ value, label: value })),
        },
        deleted_at: {
          isVisible: false,
        },
        created_at: {
          isVisible: { edit: false, filter: true, list: true, show: true },
        },
        updated_at: {
          isVisible: { edit: false, filter: true, list: true, show: true },
        },
      },
      listProperties: ['id', 'site_key', 'slug', 'title', 'publish_state', 'published_at', 'updated_at'],
      editProperties: ['site_key', 'slug', 'title', 'summary', 'body_html', 'hero_media_id', 'seo_title', 'seo_description', 'sort_order', 'publish_state', 'published_at'],
      filterProperties: ['site_key', 'slug', 'title', 'publish_state', 'published_at', 'updated_at'],
      showProperties: ['id', 'site_key', 'slug', 'title', 'summary', 'body_html', 'hero_media_id', 'seo_title', 'seo_description', 'sort_order', 'publish_state', 'published_at', 'created_at', 'updated_at'],
    },
  };
}

module.exports = {
  createNewsArticleResource,
};
